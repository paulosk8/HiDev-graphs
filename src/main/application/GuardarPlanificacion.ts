import type { AsignaturaDTO, SemanaPlanDTO } from '../../shared/dtos'
import { establecerPlanificacion } from '../domain/Asignatura'
import { ErrorDeDominio } from '../domain/errores'
import type { Servicios } from '../servicios'
import { aAsignaturaDTO } from './mapeadores'

/**
 * Guarda la planificación semanal de un período: reemplaza las semanas de ese
 * período (qué temas se tratan cada semana) en la asignatura. No afecta a los
 * demás períodos.
 */
export function guardarPlanificacion(
  servicios: Servicios,
  asignaturaId: string,
  periodo: string,
  semanas: SemanaPlanDTO[]
): AsignaturaDTO {
  const { vault } = servicios
  if (!vault.existeAsignatura(asignaturaId)) {
    throw new ErrorDeDominio('No encontramos esa asignatura.', 'Puede que ya se haya eliminado.')
  }
  const asignatura = vault.leerAsignatura(asignaturaId)
  const actualizada = establecerPlanificacion(
    asignatura,
    periodo,
    semanas.map((s) => ({ numero: s.numero, temas: s.temas }))
  )
  vault.guardarAsignatura(actualizada)
  return aAsignaturaDTO(actualizada)
}
