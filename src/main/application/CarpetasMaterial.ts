import type { ConceptoDTO } from '../../shared/dtos'
import { crearConcepto } from '../domain/Concepto'
import { crearRecurso } from '../domain/Recurso'
import { ErrorDeDominio, exigir } from '../domain/errores'
import type { Servicios } from '../servicios'
import { aConceptoDTO } from './mapeadores'

/**
 * Carpetas de material dentro de un concepto.
 *
 * Son carpetas REALES en disco, así que el docente ve la misma organización
 * desde OneDrive o el Finder. Eso obliga a mantener sincronizados el archivo
 * físico y su registro en el YAML: mover uno sin el otro dejaría material
 * huérfano.
 */

function leerConceptoExistente(servicios: Servicios, conceptoId: string) {
  if (!servicios.vault.existeConcepto(conceptoId)) {
    throw new ErrorDeDominio('No encontramos ese concepto.', 'Puede que ya se haya eliminado.')
  }
  return servicios.vault.leerConcepto(conceptoId)
}

/** Carpetas existentes en un concepto (leídas del disco). */
export function listarCarpetas(servicios: Servicios, conceptoId: string): string[] {
  leerConceptoExistente(servicios, conceptoId)
  return servicios.vault.listarCarpetasConcepto(conceptoId)
}

/** Crea una carpeta vacía. Devuelve la lista actualizada. */
export function crearCarpeta(servicios: Servicios, conceptoId: string, nombre: string): string[] {
  leerConceptoExistente(servicios, conceptoId)
  try {
    servicios.vault.crearCarpetaConcepto(conceptoId, nombre)
  } catch {
    throw new ErrorDeDominio(
      'Ese nombre de carpeta no se puede usar.',
      'Evita los caracteres \\ / : * ? " < > | y prueba otro nombre.'
    )
  }
  return servicios.vault.listarCarpetasConcepto(conceptoId)
}

/**
 * Mueve un material a otra carpeta del mismo concepto (carpeta vacía = raíz).
 * Mueve el archivo Y actualiza su registro, en ese orden: si el movimiento
 * físico falla, el YAML no se toca y nada queda descuadrado.
 */
export function moverMaterialACarpeta(
  servicios: Servicios,
  conceptoId: string,
  recursoId: string,
  carpetaDestino: string
): ConceptoDTO {
  const { vault, repositorio } = servicios
  const concepto = leerConceptoExistente(servicios, conceptoId)

  const recurso = concepto.recursos.find((r) => r.id === recursoId)
  exigir(recurso !== undefined, 'No encontramos ese material.')

  const nuevaRuta = vault.moverRecursoDeCarpeta(conceptoId, recurso!.archivo, carpetaDestino)
  if (nuevaRuta === recurso!.archivo) return aConceptoDTO(concepto)

  const actualizado = crearConcepto({
    ...concepto,
    recursos: concepto.recursos.map((r) =>
      r.id === recursoId ? crearRecurso({ ...r, archivo: nuevaRuta }) : r
    )
  })

  vault.guardarConcepto(actualizado)
  repositorio.indexarConcepto(actualizado)
  return aConceptoDTO(actualizado)
}
