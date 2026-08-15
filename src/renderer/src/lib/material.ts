import type { ResumenConceptoDTO } from '@shared/dtos'

/**
 * Cuánto material tiene un concepto: archivos MÁS enlaces web.
 *
 * Los dos cuentan igual. Un concepto cuya única fuente es un vídeo de YouTube
 * no está "sin material", y decírselo así al docente (en el semáforo de la
 * asignatura o en el listado) sería mentirle.
 */
export function totalMaterial(concepto: {
  totalRecursos: number
  totalEnlaces: number
}): number {
  return concepto.totalRecursos + concepto.totalEnlaces
}

/** Texto en español del material de un concepto ("3 materiales", "Sin material"). */
export function textoMaterial(concepto: ResumenConceptoDTO): string {
  const total = totalMaterial(concepto)
  if (total === 0) return 'Sin material'
  return `${total} ${total === 1 ? 'material' : 'materiales'}`
}
