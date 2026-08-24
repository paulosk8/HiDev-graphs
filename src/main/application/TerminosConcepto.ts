import { randomUUID } from 'node:crypto'
import type { ConceptoDTO, DatosTerminoDTO } from '../../shared/dtos'
import {
  actualizarTermino,
  agregarTermino,
  quitarTermino,
  type Concepto
} from '../domain/Concepto'
import { ErrorDeDominio } from '../domain/errores'
import { crearTermino } from '../domain/Termino'
import type { Servicios } from '../servicios'
import { aConceptoDTO } from './mapeadores'

/**
 * Glosario de un concepto: términos con su definición.
 *
 * Como los enlaces web, viven enteros en `concepto.yaml`: no hay nada que
 * copiar al disco, así que cada caso de uso es "leer → cambiar → guardar →
 * reindexar". Se reindexa porque el buscador de conceptos encuentra por
 * término, que es la mitad de su utilidad.
 */

function leerConceptoExistente(servicios: Servicios, conceptoId: string): Concepto {
  if (!servicios.vault.existeConcepto(conceptoId)) {
    throw new ErrorDeDominio('No encontramos ese concepto.', 'Puede que ya se haya eliminado.')
  }
  return servicios.vault.leerConcepto(conceptoId)
}

function guardar(servicios: Servicios, concepto: Concepto): ConceptoDTO {
  servicios.vault.guardarConcepto(concepto)
  servicios.repositorio.indexarConcepto(concepto)
  return aConceptoDTO(concepto)
}

export function agregarTerminoAConcepto(
  servicios: Servicios,
  conceptoId: string,
  datos: DatosTerminoDTO
): ConceptoDTO {
  const concepto = leerConceptoExistente(servicios, conceptoId)
  const termino = crearTermino({
    id: randomUUID(),
    termino: datos.termino,
    definicion: datos.definicion
  })
  return guardar(servicios, agregarTermino(concepto, termino))
}

export function editarTerminoDeConcepto(
  servicios: Servicios,
  conceptoId: string,
  terminoId: string,
  datos: DatosTerminoDTO
): ConceptoDTO {
  const concepto = leerConceptoExistente(servicios, conceptoId)
  const termino = crearTermino({
    id: terminoId,
    termino: datos.termino,
    definicion: datos.definicion
  })
  return guardar(servicios, actualizarTermino(concepto, termino))
}

export function eliminarTerminoDeConcepto(
  servicios: Servicios,
  conceptoId: string,
  terminoId: string
): ConceptoDTO {
  const concepto = leerConceptoExistente(servicios, conceptoId)
  return guardar(servicios, quitarTermino(concepto, terminoId))
}
