import { exigir } from './errores'

/**
 * Subtema: subdivisión opcional de un tema.
 *
 * Como el tema, es PUENTE entre capas: puede instanciar conceptos. Quien
 * organiza su estudio en detalle (o su asignatura con mucho grano) engancha el
 * material en el nivel más fino, no sólo en el intermedio.
 */
export interface Subtema {
  readonly id: string
  readonly titulo: string
  /** Posición dentro del tema (1, 2, 3...). */
  readonly orden: number
  /** Ids de los conceptos que este subtema instancia (puente entre capas). */
  readonly conceptos: readonly string[]
}

export interface DatosSubtema {
  id: string
  titulo: string
  orden: number
  conceptos?: readonly string[]
}

export function crearSubtema(datos: DatosSubtema): Subtema {
  const titulo = datos.titulo.trim()
  exigir(datos.id.trim().length > 0, 'El subtema no tiene identificador.')
  exigir(titulo.length > 0, 'El subtema necesita un título.')
  return {
    id: datos.id.trim(),
    titulo,
    orden: datos.orden,
    conceptos: datos.conceptos ?? []
  }
}

/** Vincula un concepto al subtema (puente). Evita duplicados. */
export function vincularConceptoASubtema(subtema: Subtema, conceptoId: string): Subtema {
  if (subtema.conceptos.includes(conceptoId)) return subtema
  return { ...subtema, conceptos: [...subtema.conceptos, conceptoId] }
}

/** Desvincula un concepto del subtema. */
export function desvincularConceptoDeSubtema(subtema: Subtema, conceptoId: string): Subtema {
  return { ...subtema, conceptos: subtema.conceptos.filter((id) => id !== conceptoId) }
}
