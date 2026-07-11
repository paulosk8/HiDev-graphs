import { exigir } from './errores'
import type { Tema } from './Tema'

/** Unidad: agrupa temas dentro de una asignatura. */
export interface Unidad {
  readonly id: string
  readonly titulo: string
  /** Posición dentro de la asignatura (1, 2, 3...). */
  readonly orden: number
  readonly temas: readonly Tema[]
}

export interface DatosUnidad {
  id: string
  titulo: string
  orden: number
  temas?: readonly Tema[]
}

export function crearUnidad(datos: DatosUnidad): Unidad {
  const titulo = datos.titulo.trim()
  exigir(datos.id.trim().length > 0, 'La unidad no tiene identificador.')
  exigir(titulo.length > 0, 'La unidad necesita un título.')
  return {
    id: datos.id.trim(),
    titulo,
    orden: datos.orden,
    temas: datos.temas ?? []
  }
}

/** Agrega un tema al final de la unidad. */
export function agregarTema(unidad: Unidad, tema: Tema): Unidad {
  return { ...unidad, temas: [...unidad.temas, tema] }
}
