import type { DatosConceptoDTO, ResumenConceptoDTO } from '../../shared/dtos'
import { crearConcepto as nuevoConcepto } from '../domain/Concepto'
import { ErrorDeDominio } from '../domain/errores'
import type { Servicios } from '../servicios'
import { aResumenConceptoDTO } from './mapeadores'

/**
 * Edita el nombre y la descripción de un concepto, conservando su material y
 * sus relaciones. El id (slug) NO cambia: así los vínculos existentes con temas
 * siguen siendo válidos.
 */
export function editarConcepto(
  servicios: Servicios,
  id: string,
  datos: DatosConceptoDTO
): ResumenConceptoDTO {
  const { vault, repositorio } = servicios

  if (!vault.existeConcepto(id)) {
    throw new ErrorDeDominio('No encontramos ese concepto.', 'Puede que ya se haya eliminado.')
  }

  const actual = vault.leerConcepto(id)
  const actualizado = nuevoConcepto({
    id,
    nombre: datos.nombre,
    descripcion: datos.descripcion,
    relaciones: actual.relaciones,
    recursos: actual.recursos
  })

  vault.guardarConcepto(actualizado)
  repositorio.indexarConcepto(actualizado)

  return aResumenConceptoDTO(actualizado)
}
