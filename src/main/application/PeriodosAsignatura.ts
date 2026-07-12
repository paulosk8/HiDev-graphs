import type { AsignaturaDTO } from '../../shared/dtos'
import { agregarPeriodo, quitarPeriodo } from '../domain/Asignatura'
import { ErrorDeDominio } from '../domain/errores'
import type { Servicios } from '../servicios'
import { aAsignaturaDTO } from './mapeadores'

function exigirAsignatura(servicios: Servicios, id: string): void {
  if (!servicios.vault.existeAsignatura(id)) {
    throw new ErrorDeDominio('No encontramos esa asignatura.', 'Puede que ya se haya eliminado.')
  }
}

/**
 * Añade un período a una asignatura existente: la MISMA asignatura pasa a
 * ofertarse también en ese período, sin duplicar su contenido.
 */
export function agregarPeriodoAsignatura(
  servicios: Servicios,
  id: string,
  periodo: string
): AsignaturaDTO {
  const { vault, repositorio } = servicios
  exigirAsignatura(servicios, id)

  const actualizada = agregarPeriodo(vault.leerAsignatura(id), periodo)
  vault.guardarAsignatura(actualizada)
  repositorio.indexarAsignatura(actualizada)
  return aAsignaturaDTO(actualizada)
}

/** Quita un período de una asignatura (debe quedar al menos uno). */
export function quitarPeriodoAsignatura(
  servicios: Servicios,
  id: string,
  periodo: string
): AsignaturaDTO {
  const { vault, repositorio } = servicios
  exigirAsignatura(servicios, id)

  const actualizada = quitarPeriodo(vault.leerAsignatura(id), periodo)
  vault.guardarAsignatura(actualizada)
  repositorio.indexarAsignatura(actualizada)
  return aAsignaturaDTO(actualizada)
}
