import type { AsignaturaDTO } from '../../shared/dtos'
import { ErrorDeDominio } from '../domain/errores'
import type { Servicios } from '../servicios'
import { aAsignaturaDTO } from './mapeadores'

/** Devuelve el detalle completo de una asignatura (leído del vault). */
export function obtenerAsignatura(servicios: Servicios, id: string): AsignaturaDTO {
  const { vault } = servicios

  if (!vault.existeAsignatura(id)) {
    throw new ErrorDeDominio('No encontramos esa asignatura.', 'Puede que ya se haya eliminado.')
  }

  return aAsignaturaDTO(vault.leerAsignatura(id))
}
