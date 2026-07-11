import type { IGraphRepository } from '../domain/IGraphRepository'
import type { VaultFileSystemService } from '../infrastructure/VaultFileSystemService'

export interface ResultadoReindexado {
  conceptos: number
  asignaturas: number
}

/**
 * Reconstruye por completo el índice a partir de los YAML del vault.
 *
 * Es la operación que garantiza que el índice es reconstruible: si se borra
 * `index.db`, esto lo regenera sin pérdida (criterio de aceptación 5). La
 * sincronización es unidireccional: archivos -> índice.
 */
export function reindexarVault(
  vault: VaultFileSystemService,
  repositorio: IGraphRepository
): ResultadoReindexado {
  const conceptos = vault.leerTodosConceptos()
  const asignaturas = vault.leerTodasAsignaturas()

  repositorio.vaciar()
  for (const concepto of conceptos) {
    repositorio.indexarConcepto(concepto)
  }
  for (const asignatura of asignaturas) {
    repositorio.indexarAsignatura(asignatura)
  }

  return { conceptos: conceptos.length, asignaturas: asignaturas.length }
}
