import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Detección de carpetas de nube ya instaladas en el equipo (Opción A).
 *
 * NO usamos APIs ni OAuth de los proveedores: aprovechamos que el cliente de
 * escritorio de Google Drive / OneDrive ya mantiene una carpeta local
 * sincronizada. Aquí solo BUSCAMOS esa carpeta con `existsSync` para ofrecerla
 * al docente; poner el vault dentro basta para que la nube lo sincronice sola.
 *
 * `ruta` es la carpeta contenedora: la app creará dentro un subdirectorio
 * "PedagoGraph". Soporta macOS y Windows.
 */

export type ProveedorNube = 'google' | 'onedrive'

export interface CarpetaNube {
  proveedor: ProveedorNube
  /** Nombre amigable para la UI ("Google Drive", "OneDrive · Trabajo"). */
  etiqueta: string
  /** Carpeta contenedora donde vivirá "PedagoGraph". */
  ruta: string
  /** La misma ruta, acortada con `~`, para mostrarla como texto secundario. */
  rutaVisible: string
}

/**
 * Ruta real de una carpeta (sigue enlaces simbólicos), o la misma ruta si no
 * se puede resolver. Es lo que permite ver que `~/OneDrive` y
 * `~/Library/CloudStorage/OneDrive-Personal(2)` son la MISMA carpeta: macOS
 * deja el enlace heredado apuntando al montaje, y sin resolverlo la lista
 * ofrece dos opciones idénticas con nombres distintos.
 */
function rutaReal(ruta: string): string {
  try {
    return realpathSync(ruta)
  } catch {
    return ruta
  }
}

/** Acorta la carpeta personal a `~` para que la ruta quepa y se lea. */
function acortarConHogar(ruta: string): string {
  const hogar = homedir()
  return ruta.startsWith(hogar) ? `~${ruta.slice(hogar.length)}` : ruta
}

/** ¿Es una carpeta existente y accesible? */
function esCarpeta(ruta: string): boolean {
  try {
    return existsSync(ruta) && statSync(ruta).isDirectory()
  } catch {
    return false
  }
}

/**
 * Carpeta "Mi unidad" / "My Drive" dentro de un Google Drive, o null si no
 * existe. El material debe ir ahí (área sincronizada), nunca en la raíz de la
 * cuenta (que también contiene "Ordenadores" y "Unidades compartidas").
 */
function unidadGoogleDrive(base: string): string | null {
  for (const sub of ['Mi unidad', 'My Drive']) {
    const ruta = join(base, sub)
    if (esCarpeta(ruta)) return ruta
  }
  return null
}

/** Convierte "GoogleDrive-user@gmail.com" → "user@gmail.com" (detalle de cuenta). */
function detalleCuenta(nombreCarpeta: string): string {
  const guion = nombreCarpeta.indexOf('-')
  return guion >= 0 ? nombreCarpeta.slice(guion + 1).trim() : ''
}

/** Detección específica de macOS (~/Library/CloudStorage y rutas heredadas). */
function detectarMac(hogar: string): Omit<CarpetaNube, 'rutaVisible'>[] {
  const encontradas: Omit<CarpetaNube, 'rutaVisible'>[] = []
  const cloudStorage = join(hogar, 'Library', 'CloudStorage')

  if (esCarpeta(cloudStorage)) {
    let entradas: string[] = []
    try {
      entradas = readdirSync(cloudStorage)
    } catch {
      entradas = []
    }
    for (const entrada of entradas) {
      const base = join(cloudStorage, entrada)
      if (!esCarpeta(base)) continue

      if (entrada.startsWith('GoogleDrive')) {
        const ruta = unidadGoogleDrive(base)
        if (ruta) {
          const cuenta = detalleCuenta(entrada)
          encontradas.push({
            proveedor: 'google',
            etiqueta: cuenta ? `Google Drive · ${cuenta}` : 'Google Drive',
            ruta
          })
        }
      } else if (entrada.startsWith('OneDrive')) {
        const cuenta = detalleCuenta(entrada)
        encontradas.push({
          proveedor: 'onedrive',
          etiqueta: cuenta ? `OneDrive · ${cuenta}` : 'OneDrive',
          ruta: base
        })
      }
    }
  }

  // Rutas heredadas (clientes antiguos) por si CloudStorage no aplica.
  const legadoGoogle = join(hogar, 'Google Drive')
  if (esCarpeta(legadoGoogle)) {
    encontradas.push({ proveedor: 'google', etiqueta: 'Google Drive', ruta: legadoGoogle })
  }
  const legadoOneDrive = join(hogar, 'OneDrive')
  if (esCarpeta(legadoOneDrive)) {
    encontradas.push({ proveedor: 'onedrive', etiqueta: 'OneDrive', ruta: legadoOneDrive })
  }

  return encontradas
}

/** Detección específica de Windows (variables de entorno + unidades montadas). */
function detectarWindows(hogar: string): Omit<CarpetaNube, 'rutaVisible'>[] {
  const encontradas: Omit<CarpetaNube, 'rutaVisible'>[] = []

  // OneDrive expone su ruta en variables de entorno cuando está activo.
  const varsOneDrive = [
    process.env.OneDrive,
    process.env.OneDriveConsumer,
    process.env.OneDriveCommercial
  ]
  for (const v of varsOneDrive) {
    if (v && esCarpeta(v)) {
      encontradas.push({ proveedor: 'onedrive', etiqueta: 'OneDrive', ruta: v })
    }
  }
  const oneDrivePerfil = join(hogar, 'OneDrive')
  if (esCarpeta(oneDrivePerfil)) {
    encontradas.push({ proveedor: 'onedrive', etiqueta: 'OneDrive', ruta: oneDrivePerfil })
  }

  // Google Drive: cliente antiguo (carpeta en el perfil) o unidad virtual (G:, H:…).
  const googlePerfil = join(hogar, 'Google Drive')
  if (esCarpeta(googlePerfil)) {
    encontradas.push({ proveedor: 'google', etiqueta: 'Google Drive', ruta: googlePerfil })
  }
  const LETRAS = 'DEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  for (const letra of LETRAS) {
    const ruta = unidadGoogleDrive(`${letra}:\\`)
    if (ruta) {
      encontradas.push({ proveedor: 'google', etiqueta: `Google Drive (${letra}:)`, ruta })
    }
  }

  return encontradas
}

/**
 * Devuelve las carpetas de nube detectadas en el equipo, sin duplicados.
 * Lista vacía = no hay Google Drive ni OneDrive instalados (la UI lo indica).
 */
export function detectarCarpetasNube(): CarpetaNube[] {
  const hogar = homedir()
  const brutas: Omit<CarpetaNube, 'rutaVisible'>[] =
    process.platform === 'win32' ? detectarWindows(hogar) : detectarMac(hogar)

  // Dedup por ruta REAL (no por el texto de la ruta): así dos entradas que
  // apuntan a la misma carpeta por caminos distintos se ofrecen una sola vez.
  const vistas = new Set<string>()
  const unicas: CarpetaNube[] = []
  for (const c of brutas) {
    const clave = rutaReal(c.ruta).toLowerCase()
    if (vistas.has(clave)) continue
    vistas.add(clave)
    unicas.push({ ...c, rutaVisible: acortarConHogar(c.ruta) })
  }
  return unicas
}

export interface ResumenCarpeta {
  existe: boolean
  conceptos: number
  asignaturas: number
  esMaterial: boolean
}

/**
 * Qué hay en una carpeta. Solo LISTA carpetas (no abre archivos), así que una
 * nube dormida devuelve ceros en vez de colgarse esperando la descarga.
 */
function resumirCarpeta(raiz: string): ResumenCarpeta {
  if (!esCarpeta(raiz)) return { existe: false, conceptos: 0, asignaturas: 0, esMaterial: false }

  const contar = (sub: string, marcador: string): number => {
    const dir = join(raiz, sub)
    if (!esCarpeta(dir)) return 0
    try {
      return readdirSync(dir, { withFileTypes: true }).filter(
        (e) => e.isDirectory() && existsSync(join(dir, e.name, marcador))
      ).length
    } catch {
      return 0
    }
  }

  const conceptos = contar('conceptos', 'concepto.yaml')
  const asignaturas = contar('asignaturas', 'pea.yaml')
  return {
    existe: true,
    conceptos,
    asignaturas,
    esMaterial: conceptos + asignaturas > 0
  }
}

/**
 * Mira la carpeta señalada Y la que habría dentro con ese nombre.
 *
 * Las dos son respuestas razonables a "¿dónde está tu material?": el docente
 * puede señalar la carpeta que lo contiene o el material mismo. Devolviendo
 * ambas, la interfaz reconoce cuál señaló y no acaba creando
 * `PedagoGraph/PedagoGraph`.
 */
/** Carpetas que NO se recorren al buscar material: ruido o pozos sin fondo. */
const CARPETAS_IGNORADAS = new Set([
  'node_modules',
  'Library',
  'Eliminados',
  '.index',
  'Applications',
  'Aplicaciones'
])

/** Hasta dónde se baja buscando material dentro de una carpeta de nube. */
const PROFUNDIDAD_MAX = 3
/** Tope de carpetas visitadas, para que una nube enorme no cuelgue el diálogo. */
const VISITAS_MAX = 500
/**
 * Cuánto se espera a una sola carpeta antes de darla por dormida.
 *
 * Listar una carpeta de Google Drive que no está descargada puede tardar un
 * minuto: la nube la materializa en ese momento. Una sola de esas basta para
 * dejar el diálogo colgado, así que se abandona y se sigue con las demás.
 */
const MS_POR_CARPETA = 700
/** Presupuesto total de la búsqueda. Al agotarse se devuelve lo encontrado. */
const MS_TOTAL = 6000
/**
 * Cuántas carpetas se miran a la vez.
 *
 * Es lo que hace viable el plazo: casi todas responden al instante y solo las
 * dormidas cuestan sus 700 ms. En serie, una nube con treinta carpetas dormidas
 * agota el presupuesto antes de bajar un nivel y no encuentra nada; en paralelo
 * un nivel entero cuesta poco más que su carpeta más lenta.
 */
const EN_PARALELO = 12

/** Espera a `promesa` como mucho `ms`; devuelve `null` si tarda más. */
async function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T | null> {
  let temporizador: NodeJS.Timeout | undefined
  const limite = new Promise<null>((resolver) => {
    temporizador = setTimeout(() => resolver(null), ms)
  })
  try {
    // La promesa abandonada se resuelve sola más tarde y se descarta: no hay
    // forma de cancelar una lectura de disco a medias.
    return await Promise.race([promesa.catch(() => null), limite])
  } finally {
    clearTimeout(temporizador)
  }
}

/** Subcarpetas de `dir`, o `null` si no responde a tiempo. */
async function subcarpetas(dir: string): Promise<string[] | null> {
  const entradas = await conLimite(readdir(dir, { withFileTypes: true }), MS_POR_CARPETA)
  if (!entradas) return null
  return entradas
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !CARPETAS_IGNORADAS.has(e.name))
    .map((e) => e.name)
}

/** Las carpetas que delatan un vault: si están, esa carpeta ES el material. */
const MARCAS_VAULT = ['conceptos', 'asignaturas']

/** Como `resumirCarpeta`, pero sin bloquear y rindiéndose si la nube no responde. */
async function resumirCarpetaAsync(raiz: string): Promise<ResumenCarpeta> {
  const contar = async (sub: string, marcador: string): Promise<number> => {
    const entradas = await conLimite(
      readdir(join(raiz, sub), { withFileTypes: true }),
      MS_POR_CARPETA
    )
    if (!entradas) return 0
    let n = 0
    for (const e of entradas) {
      if (e.isDirectory() && existsSync(join(raiz, sub, e.name, marcador))) n++
    }
    return n
  }

  const conceptos = await contar('conceptos', 'concepto.yaml')
  const asignaturas = await contar('asignaturas', 'pea.yaml')
  return {
    existe: true,
    conceptos,
    asignaturas,
    esMaterial: conceptos + asignaturas > 0
  }
}

export interface MaterialEncontrado {
  /** Carpeta del material (la que contiene conceptos/, asignaturas/…). */
  ruta: string
  rutaVisible: string
  /** Nombre de la carpeta, que es como el docente la reconoce. */
  nombre: string
  conceptos: number
  asignaturas: number
}

/**
 * Busca carpetas de material YA existentes dentro de las raíces indicadas.
 *
 * Sin esto, la lista solo ofrece la raíz de cada nube ("OneDrive · Personal") y
 * el docente tiene que acordarse de en qué subcarpeta puso su material y llegar
 * hasta ella con el explorador. Su material está ahí, a dos carpetas de
 * distancia: lo que hay que hacer es encontrarlo y ofrecérselo por su nombre.
 *
 * Tres reglas que no son opcionales, todas por la misma razón —una carpeta de
 * nube sin descargar tarda hasta un minuto en listarse:
 *  1. Es ASÍNCRONA. Una versión síncrona congela el proceso principal entero,
 *     y con él la ventana, mientras la nube materializa una carpeta.
 *  2. Recorre en ANCHURA. El material suele estar a uno o dos niveles; en
 *     profundidad se pierde tiempo en la primera rama que toque.
 *  3. Tiene PLAZO, por carpeta y total. Al agotarse devuelve lo encontrado
 *     hasta ese momento; encontrar de menos es aceptable, colgarse no.
 */
export async function buscarMaterialExistente(
  raices: readonly string[]
): Promise<MaterialEncontrado[]> {
  const encontrados: MaterialEncontrado[] = []
  const vistas = new Set<string>()
  const finaliza = Date.now() + MS_TOTAL

  // Cada raíz avanza por su cuenta y todas a la vez. Con una cola común, un
  // Google Drive dormido consume el plazo recorriendo SU primer nivel y las
  // demás nubes no llegan a bajar al nivel donde está el material.
  await Promise.all(raices.filter((r) => esCarpeta(r)).map((raiz) => recorrerRaiz(raiz)))
  return encontrados

  async function recorrerRaiz(raiz: string): Promise<void> {
    let nivel: string[] = [raiz]
    for (let profundidad = 0; profundidad <= PROFUNDIDAD_MAX; profundidad++) {
      const siguiente: string[] = []

      // Solo las que no se han visto ya; el dedup es por ruta real (enlaces).
      const pendientes = nivel.filter((dir) => {
        const clave = rutaReal(dir).toLowerCase()
        if (vistas.has(clave)) return false
        vistas.add(clave)
        return true
      })

      for (let i = 0; i < pendientes.length; i += EN_PARALELO) {
        if (vistas.size >= VISITAS_MAX + EN_PARALELO || Date.now() >= finaliza) return
        await Promise.all(
          pendientes.slice(i, i + EN_PARALELO).map(async (dir) => {
            // UNA sola lectura por carpeta. Contar el material cuesta dos más,
            // así que solo se hace cuando la carpeta ya parece un vault: con
            // cientos de candidatas, mirar de más agota el plazo antes de bajar
            // al nivel donde de verdad está el material.
            const hijos = await subcarpetas(dir)
            if (!hijos) return
            if (MARCAS_VAULT.some((m) => hijos.includes(m))) {
              const resumen = await resumirCarpetaAsync(dir)
              if (resumen.esMaterial) {
                encontrados.push({
                  ruta: dir,
                  rutaVisible: acortarConHogar(dir),
                  nombre: dir.split(/[\\/]/).filter(Boolean).pop() ?? dir,
                  conceptos: resumen.conceptos,
                  asignaturas: resumen.asignaturas
                })
                return
              }
            }
            for (const hijo of hijos) siguiente.push(join(dir, hijo))
          })
        )
      }
      if (siguiente.length === 0) break
      nivel = siguiente
    }
  }
}

export function inspeccionarCarpetaMaterial(
  contenedor: string,
  nombre: string
): { elegida: ResumenCarpeta; dentro: ResumenCarpeta } {
  return {
    elegida: resumirCarpeta(contenedor),
    dentro: resumirCarpeta(join(contenedor, nombre))
  }
}
