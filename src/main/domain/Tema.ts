import { exigir } from './errores'
import { crearSubtema, type Subtema } from './Subtema'

/**
 * Tema: unidad de enseñanza dentro de una unidad de una asignatura.
 *
 * Es el PUENTE entre las dos capas: un tema instancia uno o más conceptos
 * (campo `conceptos`, ids de la capa de conocimiento). Así el material de un
 * concepto se reutiliza en cualquier tema de cualquier asignatura.
 */
export interface Tema {
  readonly id: string
  readonly titulo: string
  /** Posición dentro de la unidad (1, 2, 3...). */
  readonly orden: number
  /** Semana de planificación en la que se imparte (o null si no asignada). */
  readonly semana: number | null
  readonly subtemas: readonly Subtema[]
  /** Ids de los conceptos que este tema instancia (puente entre capas). */
  readonly conceptos: readonly string[]
}

export interface DatosTema {
  id: string
  titulo: string
  orden: number
  semana?: number | null
  subtemas?: readonly Subtema[]
  conceptos?: readonly string[]
}

export function crearTema(datos: DatosTema): Tema {
  const titulo = datos.titulo.trim()
  exigir(datos.id.trim().length > 0, 'El tema no tiene identificador.')
  exigir(titulo.length > 0, 'El tema necesita un título.')
  return {
    id: datos.id.trim(),
    titulo,
    orden: datos.orden,
    semana: datos.semana ?? null,
    subtemas: datos.subtemas ?? [],
    conceptos: datos.conceptos ?? []
  }
}

/** Agrega un subtema al final del tema. */
export function agregarSubtema(tema: Tema, subtema: Subtema): Tema {
  return { ...tema, subtemas: [...tema.subtemas, subtema] }
}

/** Crea y agrega un subtema calculando su orden automáticamente. */
export function agregarNuevoSubtema(tema: Tema, id: string, titulo: string): Tema {
  const subtema = crearSubtema({ id, titulo, orden: tema.subtemas.length + 1 })
  return agregarSubtema(tema, subtema)
}

/** Vincula un concepto al tema (puente). Evita duplicados. */
export function vincularConcepto(tema: Tema, conceptoId: string): Tema {
  if (tema.conceptos.includes(conceptoId)) return tema
  return { ...tema, conceptos: [...tema.conceptos, conceptoId] }
}

/** Desvincula un concepto del tema. */
export function desvincularConcepto(tema: Tema, conceptoId: string): Tema {
  return { ...tema, conceptos: tema.conceptos.filter((id) => id !== conceptoId) }
}
