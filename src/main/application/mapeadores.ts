import type { ConceptoDTO, ResumenConceptoDTO } from '../../shared/dtos'
import type { Concepto } from '../domain/Concepto'

/** Convierte un concepto del dominio en su DTO de detalle para la ficha. */
export function aConceptoDTO(concepto: Concepto): ConceptoDTO {
  return {
    id: concepto.id,
    nombre: concepto.nombre,
    descripcion: concepto.descripcion,
    recursos: concepto.recursos.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      archivo: r.archivo,
      formato: r.formato
    })),
    relaciones: concepto.relaciones.map((rel) => ({ destino: rel.destino, tipo: rel.tipo }))
  }
}

/** Resumen de un concepto (para respuestas de creación/edición). */
export function aResumenConceptoDTO(concepto: Concepto): ResumenConceptoDTO {
  return {
    id: concepto.id,
    nombre: concepto.nombre,
    totalRecursos: concepto.recursos.length
  }
}
