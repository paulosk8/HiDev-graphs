import type { Asignatura } from './Asignatura'
import type { Concepto } from './Concepto'
import type { ResumenAsignatura, ResumenConcepto, UsoDeConcepto } from './lecturas'

/**
 * Interfaz del repositorio del grafo (índice de consulta).
 *
 * Es la ÚNICA abstracción del dominio en la Fase 1 (SOLID pragmático: hay
 * variabilidad real, hoy SQLite). La implementación concreta vive en
 * infraestructura (`SqliteGraphRepository`).
 *
 * Reglas:
 *  - El índice es DERIVADO y reconstruible: la fuente de verdad son los YAML
 *    del vault. La sincronización es unidireccional (archivos -> índice).
 *  - Las lecturas de detalle completo de una entidad se hacen contra el vault
 *    (VaultFileSystemService); este repositorio resuelve consultas transversales
 *    y rápidas (listar, buscar, "se usa en").
 */
export interface IGraphRepository {
  // --- Sincronización (reconstrucción del índice) ---

  /** Vacía por completo el índice (paso previo a una reindexación total). */
  vaciar(): void

  /** Vuelca un concepto (nodo, sus recursos y sus relaciones) al índice. */
  indexarConcepto(concepto: Concepto): void

  /** Vuelca una asignatura (jerarquía y vínculos tema→concepto) al índice. */
  indexarAsignatura(asignatura: Asignatura): void

  /** Elimina del índice un concepto: su nodo, su material y sus aristas. */
  eliminarConcepto(conceptoId: string): void

  /** Elimina del índice una asignatura y toda su jerarquía (unidades/temas/subtemas). */
  eliminarAsignatura(asignaturaId: string): void

  // --- Consultas ---

  /** Todos los conceptos, resumidos, para el listado lateral. */
  listarConceptos(): ResumenConcepto[]

  /** Conceptos cuyo nombre coincide con el texto (autocompletado). */
  buscarConceptos(texto: string): ResumenConcepto[]

  /** Todas las asignaturas, resumidas, para el listado lateral. */
  listarAsignaturas(): ResumenAsignatura[]

  /** Lugares (asignatura › unidad › tema) donde se usa un concepto. */
  usosDeConcepto(conceptoId: string): UsoDeConcepto[]

  // --- Grafo ---

  /** Pares (concepto, asignatura) donde el concepto se instancia en algún tema. */
  usosConceptoAsignatura(): Array<{ conceptoId: string; asignaturaId: string }>

  /** Relaciones tipadas concepto → concepto. */
  relacionesEntreConceptos(): Array<{ origen: string; destino: string; tipo: string }>
}
