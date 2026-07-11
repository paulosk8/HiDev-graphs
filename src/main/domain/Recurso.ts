import { exigir } from './errores'
import type { FormatoRecurso } from './tipos'

/**
 * Recurso: una pieza de material didáctico (pdf, pptx, ...).
 *
 * Pertenece SIEMPRE a un concepto, nunca a una asignatura. El archivo físico
 * vive dentro de la carpeta del concepto en el vault; aquí solo guardamos su
 * registro. La copia del archivo la realiza la infraestructura, no el dominio.
 */
export interface Recurso {
  /** Identificador estable del recurso. */
  readonly id: string
  /** Nombre visible para el docente (ej. "Presentación tema 1"). */
  readonly nombre: string
  /** Nombre del archivo dentro de la carpeta del concepto (ej. "clase.pdf"). */
  readonly archivo: string
  /** Formato deducido de la extensión. */
  readonly formato: FormatoRecurso
}

export interface DatosRecurso {
  id: string
  nombre: string
  archivo: string
  formato: FormatoRecurso
}

export function crearRecurso(datos: DatosRecurso): Recurso {
  const nombre = datos.nombre.trim()
  const archivo = datos.archivo.trim()
  exigir(datos.id.trim().length > 0, 'El material no tiene identificador.')
  exigir(
    nombre.length > 0,
    'El material necesita un nombre.',
    'Escribe un nombre para reconocerlo fácilmente.'
  )
  exigir(archivo.length > 0, 'El material no tiene archivo asociado.')

  return { id: datos.id.trim(), nombre, archivo, formato: datos.formato }
}
