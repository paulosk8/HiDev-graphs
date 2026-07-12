import type { AsignaturaDTO } from '../../shared/dtos'
import type { Asignatura } from '../domain/Asignatura'
import { ErrorDeDominio } from '../domain/errores'
import { desvincularConcepto, vincularConcepto, type Tema } from '../domain/Tema'
import type { Servicios } from '../servicios'
import { aAsignaturaDTO } from './mapeadores'

/** Aplica una transformación al tema indicado dentro de una asignatura. */
function mapearTema(
  asignatura: Asignatura,
  temaId: string,
  transformar: (tema: Tema) => Tema
): { asignatura: Asignatura; encontrado: boolean } {
  let encontrado = false
  const unidades = asignatura.unidades.map((u) => ({
    ...u,
    temas: u.temas.map((t) => {
      if (t.id !== temaId) return t
      encontrado = true
      return transformar(t)
    })
  }))
  return { asignatura: { ...asignatura, unidades }, encontrado }
}

function guardarYReindexar(servicios: Servicios, asignatura: Asignatura): AsignaturaDTO {
  servicios.vault.guardarAsignatura(asignatura)
  servicios.repositorio.indexarAsignatura(asignatura)
  return aAsignaturaDTO(asignatura)
}

/**
 * Vincula un concepto a un tema (el puente entre capas). Valida que existan la
 * asignatura, el concepto y el tema. La operación es idempotente (no duplica).
 */
export function vincularTemaConcepto(
  servicios: Servicios,
  asignaturaId: string,
  temaId: string,
  conceptoId: string
): AsignaturaDTO {
  const { vault } = servicios

  if (!vault.existeAsignatura(asignaturaId)) {
    throw new ErrorDeDominio('No encontramos esa asignatura.', 'Puede que ya se haya eliminado.')
  }
  if (!vault.existeConcepto(conceptoId)) {
    throw new ErrorDeDominio('No encontramos ese concepto.', 'Puede que ya se haya eliminado.')
  }

  const { asignatura, encontrado } = mapearTema(vault.leerAsignatura(asignaturaId), temaId, (t) =>
    vincularConcepto(t, conceptoId)
  )
  if (!encontrado) {
    throw new ErrorDeDominio('No encontramos ese tema.', 'Actualiza la asignatura e inténtalo de nuevo.')
  }

  return guardarYReindexar(servicios, asignatura)
}

/** Quita el vínculo entre un tema y un concepto. */
export function desvincularTemaConcepto(
  servicios: Servicios,
  asignaturaId: string,
  temaId: string,
  conceptoId: string
): AsignaturaDTO {
  const { vault } = servicios

  if (!vault.existeAsignatura(asignaturaId)) {
    throw new ErrorDeDominio('No encontramos esa asignatura.', 'Puede que ya se haya eliminado.')
  }

  const { asignatura, encontrado } = mapearTema(vault.leerAsignatura(asignaturaId), temaId, (t) =>
    desvincularConcepto(t, conceptoId)
  )
  if (!encontrado) {
    throw new ErrorDeDominio('No encontramos ese tema.', 'Actualiza la asignatura e inténtalo de nuevo.')
  }

  return guardarYReindexar(servicios, asignatura)
}
