import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { app, safeStorage, shell } from 'electron'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { SesionDTO, UsuarioDTO } from '../../shared/dtos'
import { ErrorDeDominio } from '../domain/errores'
import { obtenerConfigSupabase } from './configSupabase'

/**
 * Sesión persistida localmente para reanudarla entre arranques.
 *
 * Guarda también el perfil (`usuario`) para poder **arrancar sin conexión**:
 * si al refrescar el token no hay red, se reconstruye la sesión desde aquí
 * en vez de obligar a iniciar sesión de nuevo.
 */
interface SesionGuardada {
  access_token: string
  refresh_token: string
  usuario?: UsuarioDTO
}

/**
 * Autenticación con Google a través de Supabase, desde el proceso principal.
 *
 * Flujo de escritorio: abre el navegador del sistema con la URL de OAuth
 * (Supabase → Google), y captura la redirección de vuelta en un servidor HTTP
 * efímero en 127.0.0.1 (flujo PKCE, `exchangeCodeForSession`). La sesión se
 * guarda cifrada con `safeStorage` para reanudarla al reabrir la app.
 *
 * No sube archivos ni datos: solo gestiona la identidad. Los datos del usuario
 * viven en Postgres (fase siguiente); el material sigue siendo local.
 */
export class SupabaseAuthService {
  private cliente: SupabaseClient | null = null
  /** Almacenamiento en memoria para que el verificador PKCE sobreviva entre llamadas. */
  private readonly memoria = new Map<string, string>()
  /** Tiempo máximo de espera al refrescar el token en el arranque (ms). Pasado ese
   * plazo se asume "sin conexión" y se arranca con la sesión cacheada. */
  private tiempoMaxRed = 8000

  get configurado(): boolean {
    return obtenerConfigSupabase() !== null
  }

  /** Comprobación barata (sin red) de si hay una sesión guardada localmente. */
  haySesionGuardada(): boolean {
    return existsSync(this.rutaTokens)
  }

  private get rutaTokens(): string {
    return join(app.getPath('userData'), 'sesion.dat')
  }

  private obtenerCliente(): SupabaseClient {
    if (this.cliente) return this.cliente
    const config = obtenerConfigSupabase()
    if (!config) {
      throw new ErrorDeDominio(
        'El inicio de sesión aún no está configurado.',
        'Falta conectar la app con Supabase (revisa el archivo .env).'
      )
    }
    this.cliente = createClient(config.url, config.anonKey, {
      auth: {
        flowType: 'pkce',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: {
          getItem: (k) => this.memoria.get(k) ?? null,
          setItem: (k, v) => void this.memoria.set(k, v),
          removeItem: (k) => void this.memoria.delete(k)
        }
      }
    })
    return this.cliente
  }

  /** Abre el navegador, espera la redirección y devuelve la sesión creada. */
  async iniciarSesion(): Promise<SesionDTO> {
    const cliente = this.obtenerCliente()
    const { puerto, esperarCodigo, cerrar } = await this.abrirServidorRedireccion()
    try {
      const { data, error } = await cliente.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `http://127.0.0.1:${puerto}`,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' }
        }
      })
      if (error || !data?.url) {
        throw new ErrorDeDominio('No se pudo iniciar el inicio de sesión con Google.')
      }
      await shell.openExternal(data.url)

      const codigo = await esperarCodigo
      const intercambio = await cliente.auth.exchangeCodeForSession(codigo)
      if (intercambio.error || !intercambio.data.session) {
        throw new ErrorDeDominio('No se pudo completar el inicio de sesión.')
      }
      const { access_token, refresh_token, user } = intercambio.data.session
      const usuario = this.aUsuario(user)
      this.guardarSesion({ access_token, refresh_token, usuario })
      return { usuario }
    } finally {
      cerrar()
    }
  }

  /**
   * Cliente Supabase con la sesión del usuario ya aplicada (para operar sobre
   * sus datos respetando Row-Level Security). Lanza si no hay sesión activa.
   */
  async obtenerClienteAutenticado(): Promise<SupabaseClient> {
    const cliente = this.obtenerCliente()
    const { data } = await cliente.auth.getSession()
    if (data.session) return cliente
    // No hay sesión cargada en el cliente: intenta reanudar desde los tokens.
    const sesion = await this.obtenerSesion()
    if (!sesion) {
      throw new ErrorDeDominio(
        'Necesitas iniciar sesión para usar la nube.',
        'Inicia sesión con Google y vuelve a intentarlo.'
      )
    }
    return cliente
  }

  async cerrarSesion(): Promise<void> {
    try {
      await this.obtenerCliente().auth.signOut()
    } catch {
      /* aunque falle la red, la sesión local se borra igual */
    }
    if (existsSync(this.rutaTokens)) rmSync(this.rutaTokens, { force: true })
  }

  /**
   * Reanuda la sesión guardada refrescando el token contra Supabase.
   *
   * Tolerante a la falta de red (arranque offline): si el refresco falla por
   * conexión (excepción, timeout o error transitorio/servidor) **conserva** la
   * sesión local y la devuelve desde la caché, para que la app arranque sin
   * internet. Solo borra la sesión ante un rechazo de autenticación real
   * (token revocado/expirado sin refresco válido). `null` si no hay sesión
   * guardada ni forma de reconstruir el perfil.
   */
  async obtenerSesion(): Promise<SesionDTO | null> {
    const fake = this.sesionDePrueba()
    if (fake) return fake
    if (!this.configurado) return null

    const guardada = this.leerTokens()
    if (!guardada) return null
    const cacheada = guardada.usuario ?? this.usuarioDesdeJwt(guardada.access_token)
    const sesionOffline = (): SesionDTO | null => (cacheada ? { usuario: cacheada } : null)

    let resultado: Awaited<ReturnType<SupabaseClient['auth']['setSession']>> | 'timeout'
    try {
      const cliente = this.obtenerCliente()
      resultado = await this.conTimeout(
        cliente.auth.setSession({
          access_token: guardada.access_token,
          refresh_token: guardada.refresh_token
        }),
        this.tiempoMaxRed
      )
    } catch {
      // La petición lanzó (típicamente "fetch failed" sin red): arranca offline.
      return sesionOffline()
    }

    if (resultado === 'timeout') return sesionOffline()

    const { data, error } = resultado
    if (error) {
      // Distinguir "sin red / servidor caído" (transitorio) de "token inválido".
      if (this.esRechazoDeAutenticacion(error)) {
        rmSync(this.rutaTokens, { force: true })
        return null
      }
      return sesionOffline()
    }
    if (!data.session) {
      rmSync(this.rutaTokens, { force: true })
      return null
    }
    // El token pudo rotar al refrescarse: se vuelve a guardar (con el perfil).
    const usuario = this.aUsuario(data.session.user)
    this.guardarSesion({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      usuario
    })
    return { usuario }
  }

  // --- Internos ---

  /** Corre una promesa con tope de tiempo; devuelve `'timeout'` si se excede. */
  private conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T | 'timeout'> {
    return Promise.race([
      promesa,
      new Promise<'timeout'>((res) => setTimeout(() => res('timeout'), ms))
    ])
  }

  /**
   * `true` solo si el error indica credenciales rechazadas por el servidor
   * (token/refresh inválido) y no un problema de red o del servidor. Ante la
   * duda devuelve `false` para **no** cerrar la sesión local (offline-safe).
   */
  private esRechazoDeAutenticacion(error: unknown): boolean {
    const e = error as { status?: number; name?: string } | null
    if (!e) return false
    if (e.name === 'AuthRetryableFetchError') return false // red/transitorio
    const status = e.status ?? 0
    return status === 400 || status === 401 || status === 403 || status === 422
  }

  /** Reconstruye el perfil desde los claims del JWT (sin red), para sesiones
   * guardadas antes de que se persistiera el usuario. `null` si no se puede. */
  private usuarioDesdeJwt(accessToken: string): UsuarioDTO | null {
    try {
      const payload = accessToken.split('.')[1]
      if (!payload) return null
      const json = Buffer.from(
        payload.replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      ).toString('utf8')
      const claims = JSON.parse(json) as {
        sub?: string
        email?: string
        user_metadata?: Record<string, unknown>
      }
      if (!claims.sub) return null
      return this.aUsuario({
        id: claims.sub,
        email: claims.email,
        user_metadata: claims.user_metadata
      })
    } catch {
      return null
    }
  }

  private aUsuario(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }): UsuarioDTO {
    const meta = user.user_metadata ?? {}
    const nombre =
      (meta.full_name as string) || (meta.name as string) || (user.email ?? 'Usuario')
    const foto = (meta.avatar_url as string) || (meta.picture as string) || undefined
    return { id: user.id, email: user.email ?? '', nombre, foto }
  }

  private guardarSesion(sesion: SesionGuardada): void {
    const texto = JSON.stringify(sesion)
    const datos = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(texto)
      : Buffer.from(texto, 'utf8')
    writeFileSync(this.rutaTokens, datos)
  }

  private leerTokens(): SesionGuardada | null {
    if (!existsSync(this.rutaTokens)) return null
    try {
      const buffer = readFileSync(this.rutaTokens)
      const texto = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(buffer)
        : buffer.toString('utf8')
      const obj = JSON.parse(texto) as SesionGuardada
      return obj.access_token && obj.refresh_token ? obj : null
    } catch {
      return null
    }
  }

  /** Sesión ficticia para smoke tests (PEDAGOGRAPH_AUTH_FAKE=1). No afecta a producción. */
  private sesionDePrueba(): SesionDTO | null {
    if (process.env.PEDAGOGRAPH_AUTH_FAKE !== '1') return null
    return {
      usuario: { id: 'fake', email: 'docente@ejemplo.com', nombre: 'Docente de Prueba' }
    }
  }

  private async abrirServidorRedireccion(): Promise<{
    puerto: number
    esperarCodigo: Promise<string>
    cerrar: () => void
  }> {
    let resolver!: (codigo: string) => void
    let rechazar!: (err: Error) => void
    const esperarCodigo = new Promise<string>((res, rej) => {
      resolver = res
      rechazar = rej
    })

    const servidor = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const codigo = url.searchParams.get('code')
      const errorOAuth = url.searchParams.get('error')
      if (!codigo && !errorOAuth) {
        res.writeHead(204).end()
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        errorOAuth
          ? '<h2>No se pudo iniciar sesión.</h2><p>Puedes cerrar esta pestaña.</p>'
          : '<h2>¡Listo! Ya iniciaste sesión en PedagoGraph.</h2><p>Puedes cerrar esta pestaña y volver a la app.</p>'
      )
      if (errorOAuth) rechazar(new ErrorDeDominio('Se canceló el inicio de sesión.'))
      else resolver(codigo!)
    })

    // Tiempo máximo de espera de la redirección (5 min).
    const temporizador = setTimeout(
      () => rechazar(new ErrorDeDominio('El inicio de sesión tardó demasiado. Inténtalo de nuevo.')),
      5 * 60 * 1000
    )

    await new Promise<void>((res) => servidor.listen(0, '127.0.0.1', res))
    const puerto = (servidor.address() as AddressInfo).port

    return {
      puerto,
      esperarCodigo,
      cerrar: () => {
        clearTimeout(temporizador)
        servidor.close()
      }
    }
  }
}
