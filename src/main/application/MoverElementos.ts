import type { AsignaturaDTO, ConceptoDTO } from '../../shared/dtos'
import { crearConcepto } from '../domain/Concepto'
import { ErrorDeDominio, exigir } from '../domain/errores'
import type { Servicios } from '../servicios'
import { aAsignaturaDTO, aConceptoDTO } from './mapeadores'

/**
 * Reorganizar el contenido: mover un tema a otra unidad, o una nota a otro
 * concepto.
 *
 * Alcance deliberado: el tema se mueve DENTRO de su asignatura. Moverlo a otra
 * asignatura rompería lo que apunta a él —las tareas lo referencian por id y
 * viven atadas a una asignatura, y la planificación semanal lo coloca en una
 * semana de un período concreto—, así que eso necesita decidir qué pasa con
 * esas tareas y no se resuelve con un "mover" silencioso.
 *
 * Las notas sí cruzan de concepto sin problema: no las referencia nadie.
 */

/** Mueve un tema (con sus subtemas y vínculos) a otra unidad de la misma asignatura. */
export function moverTema(
  servicios: Servicios,
  asignaturaId: string,
  temaId: string,
  unidadDestinoId: string
): AsignaturaDTO {
  const { vault, repositorio } = servicios

  if (!vault.existeAsignatura(asignaturaId)) {
    throw new ErrorDeDominio('No encontramos esa asignatura.', 'Puede que ya se haya eliminado.')
  }
  const asignatura = vault.leerAsignatura(asignaturaId)

  const unidadOrigen = asignatura.unidades.find((u) => u.temas.some((t) => t.id === temaId))
  exigir(unidadOrigen !== undefined, 'No encontramos ese tema en la asignatura.')

  const destino = asignatura.unidades.find((u) => u.id === unidadDestinoId)
  exigir(
    destino !== undefined,
    'No encontramos el destino elegido.',
    'Elige una unidad de esta misma asignatura.'
  )

  if (unidadOrigen!.id === unidadDestinoId) return aAsignaturaDTO(asignatura)

  const tema = unidadOrigen!.temas.find((t) => t.id === temaId)!

  // El tema conserva su id: así siguen valiendo sus vínculos con conceptos, las
  // tareas que lo usan y su sitio en la planificación semanal.
  const unidades = asignatura.unidades.map((u) => {
    if (u.id === unidadOrigen!.id) {
      return { ...u, temas: u.temas.filter((t) => t.id !== temaId) }
    }
    if (u.id === unidadDestinoId) {
      return { ...u, temas: [...u.temas, { ...tema, orden: u.temas.length }] }
    }
    return u
  })

  // Renumera el orden dentro de cada unidad para que no queden huecos.
  const actualizada = {
    ...asignatura,
    unidades: unidades.map((u) => ({
      ...u,
      temas: u.temas.map((t, i) => ({ ...t, orden: i }))
    }))
  }

  vault.guardarAsignatura(actualizada)
  repositorio.indexarAsignatura(actualizada)
  return aAsignaturaDTO(actualizada)
}

/**
 * Mueve una nota de un concepto a otro. Devuelve el concepto ORIGEN ya
 * actualizado, que es la ficha desde la que se ha pedido el movimiento.
 */
export function moverNota(
  servicios: Servicios,
  conceptoOrigenId: string,
  notaId: string,
  conceptoDestinoId: string
): ConceptoDTO {
  const { vault, repositorio } = servicios

  exigir(
    conceptoOrigenId !== conceptoDestinoId,
    'La nota ya está en ese concepto.',
    'Elige un concepto distinto.'
  )
  if (!vault.existeConcepto(conceptoOrigenId) || !vault.existeConcepto(conceptoDestinoId)) {
    throw new ErrorDeDominio('No encontramos uno de los conceptos.', 'Puede que se haya eliminado.')
  }

  const origen = vault.leerConcepto(conceptoOrigenId)
  const nota = origen.notas.find((n) => n.id === notaId)
  exigir(nota !== undefined, 'No encontramos esa nota.')

  const destino = vault.leerConcepto(conceptoDestinoId)

  const origenActualizado = crearConcepto({
    ...origen,
    notas: origen.notas.filter((n) => n.id !== notaId)
  })
  const destinoActualizado = crearConcepto({
    ...destino,
    notas: [...destino.notas, nota!]
  })

  // Primero el destino: si algo fallara al escribir, es preferible que la nota
  // aparezca duplicada a que se pierda.
  vault.guardarConcepto(destinoActualizado)
  vault.guardarConcepto(origenActualizado)
  repositorio.indexarConcepto(destinoActualizado)
  repositorio.indexarConcepto(origenActualizado)

  return aConceptoDTO(origenActualizado)
}
