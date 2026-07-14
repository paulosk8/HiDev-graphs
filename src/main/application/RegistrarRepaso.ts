import type { CalidadRepaso, ConceptoDTO } from '../../shared/dtos'
import { ErrorDeDominio } from '../domain/errores'
import { repasar } from '../domain/Repaso'
import type { Servicios } from '../servicios'
import { aConceptoDTO } from './mapeadores'

/**
 * Registra un repaso de un concepto: recalcula su estado de repaso espaciado
 * (dominio + próxima revisión) según la calidad del recuerdo, lo guarda en el
 * concepto (fuente de verdad) y actualiza el índice. Devuelve el concepto con
 * su nuevo dominio y próxima fecha.
 */
export function registrarRepaso(
  servicios: Servicios,
  conceptoId: string,
  calidad: CalidadRepaso
): ConceptoDTO {
  const { vault, repositorio } = servicios

  if (!vault.existeConcepto(conceptoId)) {
    throw new ErrorDeDominio('No encontramos ese concepto.', 'Puede que ya se haya eliminado.')
  }
  const q = Math.round(calidad)
  if (q < 0 || q > 5) {
    throw new ErrorDeDominio('Valoración de repaso no válida.')
  }

  const concepto = vault.leerConcepto(conceptoId)
  const hoy = new Date().toISOString().slice(0, 10)
  const actualizado = { ...concepto, repaso: repasar(concepto.repaso, q as CalidadRepaso, hoy) }

  vault.guardarConcepto(actualizado)
  repositorio.indexarConcepto(actualizado)

  return aConceptoDTO(actualizado)
}
