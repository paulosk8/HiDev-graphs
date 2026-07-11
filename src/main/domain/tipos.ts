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
export type FormatoRecurso = 'pptx' | 'pdf' | 'md' | 'html' | 'docx' | 'xml'

export const FORMATOS_SOPORTADOS: readonly FormatoRecurso[] = [
  'pptx',
  'pdf',
  'md',
  'html',
  'docx',
  'xml'
]

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
