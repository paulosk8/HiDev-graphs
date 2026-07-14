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

export type FormatoRecurso =
  | 'pptx'
  | 'pdf'
  | 'md'
  | 'html'
  | 'docx'
  | 'xml'
  | 'txt'
  | 'css'
  | 'js'
  | 'json'
  | 'csv'

export const FORMATOS_SOPORTADOS: readonly FormatoRecurso[] = [
  'pptx',
  'pdf',
  'md',
  'html',
  'docx',
  'xml',
  'txt',
  'css',
  'js',
  'json',
  'csv'
]

/** Formatos basados en texto que se pueden previsualizar como texto plano. */
export const FORMATOS_TEXTO: readonly FormatoRecurso[] = ['md', 'xml', 'txt', 'css', 'js', 'json', 'csv']

/**
 * Deduce el formato de un recurso a partir del nombre de archivo.
 * Devuelve `null` si la extensión no está soportada.
 */
export function formatoDesdeNombreArchivo(nombreArchivo: string): FormatoRecurso | null {
  const punto = nombreArchivo.lastIndexOf('.')
  if (punto < 0) return null
  const extension = nombreArchivo.slice(punto + 1).toLowerCase()
  return (FORMATOS_SOPORTADOS as readonly string[]).includes(extension)
    ? (extension as FormatoRecurso)
    : null
}
