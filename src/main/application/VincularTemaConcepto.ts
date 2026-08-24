import type { AsignaturaDTO } from '../../shared/dtos'
import type { Asignatura } from '../domain/Asignatura'
import { ErrorDeDominio } from '../domain/errores'
import { desvincularConcepto, vincularConcepto, type Tema } from '../domain/Tema'
import {
  desvincularConceptoDeSubtema,
  vincularConceptoASubtema,
  type Subtema
} from '../domain/Subtema'
import type { Servicios } from '../servicios'
import { aAsignaturaDTO } from './mapeadores'

/**
 * Aplica el vínculo al tema o al SUBTEMA indicado dentro de una asignatura.
 *
 * El mismo id sirve para los dos niveles (son uuids únicos en el vault), así
 * que el canal IPC no cambia: quien vincula sólo dice "a este punto del
 * contenido". Se busca primero en los temas y luego en sus subtemas.
 */
function mapearPunto(
  asignatura: Asignatura,
  puntoId: string,
  enTema: (tema: Tema) => Tema,
  enSubtema: (subtema: Subtema) => Subtema
): { asignatura: Asignatura; encontrado: boolean } {
  let encontrado = false
  const unidades = asignatura.unidades.map((u) => ({
    ...u,
    temas: u.temas.map((t) => {
      if (t.id === puntoId) {
        encontrado = true
        return enTema(t)
      }
      if (!t.subtemas.some((s) => s.id === puntoId)) return t
      encontrado = true
      return {
        ...t,
        subtemas: t.subtemas.map((s) => (s.id === puntoId ? enSubtema(s) : s))
      }
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
 * Vincula un concepto a un tema o subtema (el puente entre capas). Valida que
 * existan la asignatura, el concepto y el punto del contenido. La operación es
 * idempotente (no duplica).
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

  const { asignatura, encontrado } = mapearPunto(
    vault.leerAsignatura(asignaturaId),
    temaId,
    (t) => vincularConcepto(t, conceptoId),
    (s) => vincularConceptoASubtema(s, conceptoId)
  )
  if (!encontrado) {
    throw new ErrorDeDominio('No encontramos ese tema.', 'Actualiza la asignatura e inténtalo de nuevo.')
  }

  return guardarYReindexar(servicios, asignatura)
}

/** Quita el vínculo entre un tema (o subtema) y un concepto. */
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

  const { asignatura, encontrado } = mapearPunto(
    vault.leerAsignatura(asignaturaId),
    temaId,
    (t) => desvincularConcepto(t, conceptoId),
    (s) => desvincularConceptoDeSubtema(s, conceptoId)
  )
  if (!encontrado) {
    throw new ErrorDeDominio('No encontramos ese tema.', 'Actualiza la asignatura e inténtalo de nuevo.')
  }

  return guardarYReindexar(servicios, asignatura)
}
