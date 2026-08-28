import type { IGraphRepository } from '../domain/IGraphRepository'
import { lecturasFallidas } from '../infrastructure/IncidenciasLectura'
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

  // Lo que no se pudo leer va a desaparecer del índice al vaciarlo, y con ello
  // su nombre. Se rescata ANTES para poder nombrarlo en el aviso: el nombre
  // vive dentro del archivo ilegible y el de la carpeta no se muestra jamás.
  lecturasFallidas.recordarNombres('concepto', repositorio.listarConceptos())
  lecturasFallidas.recordarNombres('asignatura', repositorio.listarAsignaturas())

  repositorio.vaciar()
  for (const concepto of conceptos) {
    repositorio.indexarConcepto(concepto)
  }
  for (const asignatura of asignaturas) {
    repositorio.indexarAsignatura(asignatura)
  }

  return { conceptos: conceptos.length, asignaturas: asignaturas.length }
}
