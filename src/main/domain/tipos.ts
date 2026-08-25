/**
 * Tipos y catálogos base del dominio.
 *
 * Capa pura: sin dependencias de Electron, SQLite ni sistema de archivos.
 */

/** Clase de nodo dentro del grafo de conocimiento y curricular. */
export type TipoNodo = 'concepto' | 'asignatura' | 'unidad' | 'tema' | 'subtema'

/** Relaciones tipadas entre conceptos (capa de conocimiento). */
export type TipoRelacion = 'prerequisito_de' | 'relacionado_con' | 'profundiza'

export const TIPOS_RELACION: readonly TipoRelacion[] = [
  'prerequisito_de',
  'relacionado_con',
  'profundiza'
]

export function esTipoRelacion(valor: string): valor is TipoRelacion {
  return (TIPOS_RELACION as readonly string[]).includes(valor)
}

/** Formatos de material soportados, según su extensión de archivo. */
/** Formato de las instrucciones de una tarea: Markdown o HTML (con CSS/JS embebidos). */
export type FormatoInstrucciones = 'markdown' | 'html' | 'codigo'

/**
 * Tipo de "espacio": una asignatura para DOCENCIA o un workspace de APRENDIZAJE.
 * Comparten el mismo modelo (temas/subtemas/conceptos/material/tareas/plan); solo
 * cambia el encuadre y el lenguaje de la interfaz.
 */
export type TipoAsignatura = 'docencia' | 'aprendizaje'

/**
 * Formato de un material: simplemente su extensión en minúsculas.
 *
 * Antes era una lista cerrada, y todo lo que no estuviera en ella se
 * rechazaba. Eso no era una decisión de producto sino una limitación: el
 * docente tiene hojas de cálculo, imágenes de la pizarra, audio de una clase,
 * un `.zip` con el código de la práctica… y todo eso es material. La app no
 * necesita entender un archivo para guardarlo junto a su concepto.
 *
 * Lo que sí sigue siendo una lista es lo que la app sabe PINTAR por dentro
 * (`FORMATOS_TEXTO`, `PREVISUALIZABLES` en la vista previa). Esas son listas
 * permisivas —añaden un botón «Ver»— y no puertas: lo que no está en ellas se
 * abre igual con la aplicación del sistema.
 */
export type FormatoRecurso = string

/** Formatos basados en texto que se pueden previsualizar como texto plano. */
export const FORMATOS_TEXTO: readonly string[] = ['md', 'xml', 'txt', 'css', 'js', 'json', 'csv']

/** Imágenes que el visor pinta directamente (el esquema recurso:// las sirve). */
export const FORMATOS_IMAGEN: readonly string[] = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif']

/** Lo que se guarda cuando el archivo no tiene extensión. */
export const FORMATO_DESCONOCIDO = 'archivo'

/**
 * Deduce el formato de un material a partir del nombre de archivo. Nunca
 * falla: cualquier extensión vale, y un archivo sin extensión se marca como
 * «archivo». Devolver `null` era lo que disparaba todos los rechazos.
 */
export function formatoDesdeNombreArchivo(nombreArchivo: string): FormatoRecurso {
  const punto = nombreArchivo.lastIndexOf('.')
  if (punto < 0) return FORMATO_DESCONOCIDO
  const extension = nombreArchivo.slice(punto + 1).toLowerCase().trim()
  return extension || FORMATO_DESCONOCIDO
}
