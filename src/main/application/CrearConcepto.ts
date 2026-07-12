import type { DatosConceptoDTO, ResumenConceptoDTO } from '../../shared/dtos'
import { crearConcepto as nuevoConcepto } from '../domain/Concepto'
import { slugUnico } from '../domain/slug'
import type { Servicios } from '../servicios'
import { aResumenConceptoDTO } from './mapeadores'

/**
 * Crea un concepto: genera su id interno (slug único), escribe su YAML en el
 * vault y lo indexa. Devuelve el resumen para refrescar el listado.
 */
export function crearConcepto(servicios: Servicios, datos: DatosConceptoDTO): ResumenConceptoDTO {
  const { vault, repositorio } = servicios

  const existentes = new Set(vault.listarIdsConceptos())
  const id = slugUnico(datos.nombre, existentes, 'concepto')

  const concepto = nuevoConcepto({ id, nombre: datos.nombre, descripcion: datos.descripcion })
  vault.guardarConcepto(concepto)
  repositorio.indexarConcepto(concepto)

  return aResumenConceptoDTO(concepto)
}
