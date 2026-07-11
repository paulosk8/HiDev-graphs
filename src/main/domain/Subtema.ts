import { exigir } from './errores'

/** Subtema: subdivisión opcional de un tema. */
export interface Subtema {
  readonly id: string
  readonly titulo: string
  /** Posición dentro del tema (1, 2, 3...). */
  readonly orden: number
}

export function crearSubtema(datos: { id: string; titulo: string; orden: number }): Subtema {
  const titulo = datos.titulo.trim()
  exigir(datos.id.trim().length > 0, 'El subtema no tiene identificador.')
  exigir(titulo.length > 0, 'El subtema necesita un título.')
  return { id: datos.id.trim(), titulo, orden: datos.orden }
}
