import type { ConceptoDTO } from '../../shared/dtos'
import { quitarRecurso } from '../domain/Concepto'
import { ErrorDeDominio } from '../domain/errores'
import type { Servicios } from '../servicios'
import { aConceptoDTO } from './mapeadores'

/**
 * Quita un material de un concepto: borra su archivo del vault y actualiza el
 * concepto y el índice. Devuelve el concepto actualizado para refrescar la ficha.
 */
export function eliminarMaterial(
  servicios: Servicios,
  conceptoId: string,
  recursoId: string
): ConceptoDTO {
  const { vault, repositorio } = servicios

  if (!vault.existeConcepto(conceptoId)) {
    throw new ErrorDeDominio('No encontramos ese concepto.', 'Puede que ya se haya eliminado.')
  }

  const concepto = vault.leerConcepto(conceptoId)
  const recurso = concepto.recursos.find((r) => r.id === recursoId)
  if (!recurso) {
    throw new ErrorDeDominio('No encontramos ese material.', 'Puede que ya se haya eliminado.')
  }

  const actualizado = quitarRecurso(concepto, recursoId)
  vault.eliminarArchivoRecurso(conceptoId, recurso.archivo)
  vault.guardarConcepto(actualizado)
  repositorio.indexarConcepto(actualizado)

  return aConceptoDTO(actualizado)
}
