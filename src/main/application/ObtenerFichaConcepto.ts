import type { FichaConceptoDTO } from '../../shared/dtos'
import { ErrorDeDominio } from '../domain/errores'
import type { Servicios } from '../servicios'
import { aConceptoDTO } from './mapeadores'

/**
 * Arma la ficha de un concepto: su detalle (leído del vault, fuente de verdad)
 * y los lugares donde se usa (consultados al índice).
 */
export function obtenerFichaConcepto(servicios: Servicios, id: string): FichaConceptoDTO {
  const { vault, repositorio } = servicios

  if (!vault.existeConcepto(id)) {
    throw new ErrorDeDominio('No encontramos ese concepto.', 'Puede que ya se haya eliminado.')
  }

  return {
    concepto: aConceptoDTO(vault.leerConcepto(id)),
    usos: repositorio.usosDeConcepto(id)
  }
}
