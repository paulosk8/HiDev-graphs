/**
 * Registro de lo que NO se pudo leer del material.
 *
 * El vault puede vivir en una carpeta de OneDrive / Google Drive. Cuando el
 * cliente de nube no ha iniciado sesión, está pausado o no hay internet, los
 * archivos existen en el disco pero abrirlos falla (en macOS con `ETIMEDOUT`,
 * porque el archivo es un marcador que hay que descargar). Antes eso se
 * quedaba en un `console.warn` y el elemento simplemente no aparecía: para el
 * docente era material perdido, sin explicación.
 *
 * Este registro recuerda esos fallos para que la interfaz pueda decir qué pasó
 * y qué elementos faltan. Es memoria viva del proceso, no se persiste: un
 * arranque con la nube disponible arranca sin incidencias.
 */

/** Qué se intentaba leer. Son los nombres que ve el docente, en singular. */
export type TipoElementoLectura = 'concepto' | 'asignatura' | 'tarea' | 'lienzo'

/**
 * Por qué falló la lectura:
 *  - `nube`      → el archivo está en la nube y no se pudo descargar (lo más común).
 *  - `permisos`  → el sistema no deja abrir el archivo.
 *  - `dañado`    → se leyó, pero su contenido no se entiende.
 *  - `ubicacion` → la carpeta que el docente eligió ya no está en el equipo.
 *  - `desconocida` → cualquier otra cosa.
 */
export type CausaLectura = 'nube' | 'permisos' | 'dañado' | 'ubicacion' | 'desconocida'

/**
 * `id` reservado: la carpeta entera (conceptos/, asignaturas/…) no se pudo
 * ni siquiera listar. Es el caso extremo de la nube sin sesión: no falta un
 * elemento, falta todo lo de esa clase.
 */
export const CARPETA_COMPLETA = '*'

export interface IncidenciaLectura {
  tipo: TipoElementoLectura
  /** Carpeta/archivo interno. NUNCA se muestra al docente. */
  id: string
  /** Último nombre conocido (del índice), si lo hubo. */
  nombre?: string
  causa: CausaLectura
  /** Texto técnico del error, solo para el registro de consola. */
  detalle: string
}

/**
 * Códigos de error que delatan un archivo que vive en la nube y no está
 * disponible ahora mismo. `ETIMEDOUT` es el que devuelve macOS cuando OneDrive
 * o Google Drive no puede materializar el archivo; el resto son las variantes
 * de red y de volumen remoto que aparecen en Windows y en unidades montadas.
 */
const CODIGOS_NUBE = new Set([
  'ETIMEDOUT',
  'ENETDOWN',
  'ENETUNREACH',
  'EHOSTDOWN',
  'EHOSTUNREACH',
  'ECONNABORTED',
  'ECONNRESET',
  'EIO',
  'ESTALE',
  'EREMOTEIO',
  'EBUSY',
  'EAGAIN',
  'ENODEV'
])

const CODIGOS_PERMISOS = new Set(['EACCES', 'EPERM'])

/** Traduce el error de `readFileSync` (o del parseo) a una causa. */
export function causaDeError(error: unknown): CausaLectura {
  const codigo = (error as { code?: unknown })?.code
  if (typeof codigo === 'string') {
    if (CODIGOS_NUBE.has(codigo)) return 'nube'
    if (CODIGOS_PERMISOS.has(codigo)) return 'permisos'
    // El archivo estaba en el listado hace un instante y ya no se abre: en una
    // carpeta de nube eso es un archivo que se está sincronizando.
    if (codigo === 'ENOENT') return 'nube'
  }
  // js-yaml y JSON.parse: el archivo se leyó, pero su contenido no se entiende.
  const nombre = (error as { name?: unknown })?.name
  if (nombre === 'YAMLException' || error instanceof SyntaxError) return 'dañado'
  return 'desconocida'
}

/**
 * Fallos de nube seguidos que bastan para darla por caída durante ese recorrido.
 *
 * Cada lectura de un archivo que la nube no puede materializar tarda ~60 s en
 * rendirse (`ETIMEDOUT`). Con una carpeta de cierto tamaño eso son minutos de
 * app colgada antes de poder decir nada. A partir del tercer fallo seguido se
 * deja de intentar y el resto se anota como no leído: la app abre en segundos y
 * el aviso explica la situación. "Reintentar" recorre todo otra vez, sin corte.
 */
const UMBRAL_NUBE_CAIDA = 3

/** Prioridad al resumir varias incidencias en una sola causa para el aviso. */
const ORDEN_CAUSA: CausaLectura[] = ['ubicacion', 'nube', 'permisos', 'dañado', 'desconocida']

function clave(tipo: TipoElementoLectura, id: string): string {
  return `${tipo}:${id}`
}

class RegistroLecturasFallidas {
  private readonly fallos = new Map<string, IncidenciaLectura>()
  private readonly oyentes = new Set<() => void>()
  /** Fallos de nube seguidos dentro del recorrido en curso. */
  private nubeSeguidos = 0
  /** Mientras esté activo no se corta nunca (lo usa "Reintentar"). */
  private sinCorte = false

  /** Marca el inicio de un recorrido completo (listar + leer cada elemento). */
  iniciarBarrido(): void {
    this.nubeSeguidos = 0
  }

  /** ¿Ya se dio la nube por caída en este recorrido? */
  nubeCaida(): boolean {
    return !this.sinCorte && this.nubeSeguidos >= UMBRAL_NUBE_CAIDA
  }

  /** Ejecuta algo intentando leerlo TODO, sin cortar tras los primeros fallos. */
  intentarTodo<T>(fn: () => T): T {
    this.sinCorte = true
    try {
      return fn()
    } finally {
      this.sinCorte = false
    }
  }

  /**
   * Anota un elemento que ni se intentó leer porque el almacenamiento ya se
   * dio por caído. No se registra en consola uno por uno: el aviso al docente
   * los cuenta, y el motivo ya quedó escrito con los primeros fallos.
   */
  omitir(tipo: TipoElementoLectura, id: string): void {
    const previa = this.fallos.get(clave(tipo, id))
    this.fallos.set(clave(tipo, id), {
      tipo,
      id,
      causa: 'nube',
      detalle: 'No se intentó abrir: el almacenamiento no respondía.',
      nombre: previa?.nombre
    })
    if (!previa) this.avisar()
  }

  /**
   * Anota que la carpeta del material configurada ya no está en el equipo.
   *
   * No es un fallo de lectura: no hay nada que leer. Pasa cuando el vault vive
   * en una nube y su carpeta cambia de sitio o deja de estar montada (en macOS,
   * `CloudStorage/OneDrive-Personal(2)` desaparece al re-vincular la cuenta).
   * Se anota como carpeta entera para que el aviso hable de todo el material,
   * no de elementos sueltos.
   */
  registrarUbicacionPerdida(ruta: string): void {
    for (const tipo of ['concepto', 'asignatura', 'tarea', 'lienzo'] as const) {
      this.fallos.set(clave(tipo, CARPETA_COMPLETA), {
        tipo,
        id: CARPETA_COMPLETA,
        causa: 'ubicacion',
        detalle: `La carpeta configurada no existe: ${ruta}`
      })
    }
    console.warn(`[material] La carpeta del material no está donde se configuró: ${ruta}`)
    this.avisar()
  }

  /** Anota que un elemento no se pudo leer. */
  registrar(tipo: TipoElementoLectura, id: string, error: unknown): void {
    const causa = causaDeError(error)
    const detalle = error instanceof Error ? error.message : String(error)
    const previa = this.fallos.get(clave(tipo, id))
    this.fallos.set(clave(tipo, id), { tipo, id, causa, detalle, nombre: previa?.nombre })
    this.nubeSeguidos = causa === 'nube' ? this.nubeSeguidos + 1 : 0
    if (this.nubeCaida() && this.nubeSeguidos === UMBRAL_NUBE_CAIDA) {
      console.warn('[material] El almacenamiento no responde: se deja de insistir por ahora.')
    }
    // El aviso al docente ya no depende de esto, pero el rastro técnico sigue
    // siendo útil cuando alguien mira la consola.
    console.warn(`[material] No se pudo leer ${tipo} "${id}" (${causa}): ${detalle}`)
    if (!previa || previa.causa !== causa) this.avisar()
  }

  /** El elemento volvió a leerse bien: deja de faltar. */
  olvidar(tipo: TipoElementoLectura, id: string): void {
    this.nubeSeguidos = 0
    if (this.fallos.delete(clave(tipo, id))) this.avisar()
  }

  /**
   * Descarta las incidencias de elementos que ya no están en el vault (los
   * borró el docente mientras la nube no respondía), para que el aviso no
   * arrastre fantasmas.
   */
  conciliar(tipo: TipoElementoLectura, idsExistentes: string[]): void {
    const vivos = new Set(idsExistentes)
    let cambio = false
    for (const [k, incidencia] of this.fallos) {
      // La incidencia de carpeta entera no se concilia contra una lista que,
      // precisamente por ese fallo, vino vacía.
      if (incidencia.id === CARPETA_COMPLETA) continue
      if (incidencia.tipo === tipo && !vivos.has(incidencia.id)) {
        this.fallos.delete(k)
        cambio = true
      }
    }
    if (cambio) this.avisar()
  }

  /**
   * Guarda el último nombre conocido de los elementos que fallaron.
   *
   * Se llama con lo que hay en el índice justo ANTES de reconstruirlo: es la
   * única forma de nombrar en el aviso algo que no se pudo abrir, porque el
   * nombre vive dentro del archivo ilegible y el nombre de carpeta no se le
   * enseña nunca al docente.
   */
  recordarNombres(tipo: TipoElementoLectura, conocidos: readonly { id: string; nombre: string }[]): void {
    for (const { id, nombre } of conocidos) {
      const incidencia = this.fallos.get(clave(tipo, id))
      if (incidencia && !incidencia.nombre) incidencia.nombre = nombre
    }
  }

  /** Olvida todo (lo usa "Reintentar" antes de volver a leer el material). */
  limpiar(): void {
    this.nubeSeguidos = 0
    if (this.fallos.size === 0) return
    this.fallos.clear()
    this.avisar()
  }

  listar(): IncidenciaLectura[] {
    return [...this.fallos.values()]
  }

  get total(): number {
    return this.fallos.size
  }

  /** true si alguna carpeta del material no se pudo ni listar. */
  hayCarpetaInaccesible(): boolean {
    return this.listar().some((i) => i.id === CARPETA_COMPLETA)
  }

  /** Causa predominante, para redactar el aviso con una sola explicación. */
  causaPrincipal(): CausaLectura {
    const presentes = new Set(this.listar().map((i) => i.causa))
    return ORDEN_CAUSA.find((c) => presentes.has(c)) ?? 'desconocida'
  }

  /** Se suscribe a los cambios del registro. Devuelve cómo cancelar. */
  alCambiar(oyente: () => void): () => void {
    this.oyentes.add(oyente)
    return () => this.oyentes.delete(oyente)
  }

  private avisar(): void {
    for (const oyente of this.oyentes) oyente()
  }
}

/** Registro único del proceso principal. */
export const lecturasFallidas = new RegistroLecturasFallidas()
