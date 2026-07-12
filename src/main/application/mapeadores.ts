import type {
  AsignaturaDTO,
  ConceptoDTO,
  ResumenAsignaturaDTO,
  ResumenConceptoDTO,
  ResumenTareaDTO,
  TareaDTO
} from '../../shared/dtos'
import type { Asignatura } from '../domain/Asignatura'
import type { Concepto } from '../domain/Concepto'
import type { Tarea } from '../domain/Tarea'

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
    descripcion: concepto.descripcion,
    totalRecursos: concepto.recursos.length,
    // Un resumen recién creado/editado no conoce sus temas ni asignaturas; el
    // listado los rellena al recargar. El store conserva los previos al editar.
    temas: [],
    asignaturas: []
  }
}

/** Detalle completo de una asignatura para su ficha. */
export function aAsignaturaDTO(asignatura: Asignatura): AsignaturaDTO {
  return {
    id: asignatura.id,
    nombre: asignatura.nombre,
    periodos: [...asignatura.periodos],
    componentes: asignatura.componentes.map((c) => ({ clave: c.clave, nombre: c.nombre })),
    unidades: asignatura.unidades.map((u) => ({
      id: u.id,
      titulo: u.titulo,
      orden: u.orden,
      temas: u.temas.map((t) => ({
        id: t.id,
        titulo: t.titulo,
        orden: t.orden,
        semana: t.semana,
        subtemas: t.subtemas.map((s) => ({ id: s.id, titulo: s.titulo, orden: s.orden })),
        conceptos: [...t.conceptos]
      }))
    }))
  }
}

/** Detalle completo de una tarea. */
export function aTareaDTO(tarea: Tarea): TareaDTO {
  return {
    id: tarea.id,
    titulo: tarea.titulo,
    instrucciones: tarea.instrucciones,
    asignaturaId: tarea.asignaturaId,
    temas: [...tarea.temas],
    componente: tarea.componente,
    conceptos: [...tarea.conceptos],
    recursos: tarea.recursos.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      archivo: r.archivo,
      formato: r.formato
    }))
  }
}

/** Resumen de una tarea para listados. */
export function aResumenTareaDTO(tarea: Tarea): ResumenTareaDTO {
  return {
    id: tarea.id,
    titulo: tarea.titulo,
    asignaturaId: tarea.asignaturaId,
    temas: [...tarea.temas],
    componente: tarea.componente,
    totalAdjuntos: tarea.recursos.length
  }
}

/** Resumen de una asignatura para el listado. */
export function aResumenAsignaturaDTO(asignatura: Asignatura): ResumenAsignaturaDTO {
  const totalTemas = asignatura.unidades.reduce((n, u) => n + u.temas.length, 0)
  return {
    id: asignatura.id,
    nombre: asignatura.nombre,
    periodos: [...asignatura.periodos],
    totalUnidades: asignatura.unidades.length,
    totalTemas,
    // Una asignatura recién creada aún no tiene tareas; el listado recalcula al recargar.
    totalTareas: 0
  }
}
