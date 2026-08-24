import { randomUUID } from 'node:crypto'
import type { ConceptoDTO, DatosTerminoDTO, PromocionTerminoDTO } from '../../shared/dtos'
import {
  actualizarTermino,
  agregarTermino,
  crearConcepto as nuevoConcepto,
  quitarTermino,
  relacionarCon,
  type Concepto
} from '../domain/Concepto'
import { ErrorDeDominio } from '../domain/errores'
import { crearRelacion } from '../domain/Relacion'
import { slugUnico } from '../domain/slug'
import { claveTermino, crearTermino } from '../domain/Termino'
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

/**
 * Promueve un término a concepto propio.
 *
 * Es la salida cuando un término crece: ya no le basta una frase, quiere su
 * material y sus relaciones. Nadie acierta al principio —y el docente no
 * técnico menos—, así que la decisión no se pide por adelantado: se corrige
 * cuando se nota.
 *
 * Si ya existe un concepto con ese nombre NO se crea otro: se usa el que hay.
 * Duplicar conceptos es exactamente lo que la app existe para evitar.
 *
 * El concepto resultante queda `relacionado_con` el de origen: el término salió
 * de ahí, y esa procedencia es información, no ruido.
 */
export function promoverTerminoAConcepto(
  servicios: Servicios,
  conceptoId: string,
  terminoId: string
): PromocionTerminoDTO {
  const { vault, repositorio } = servicios
  const concepto = leerConceptoExistente(servicios, conceptoId)
  const termino = concepto.terminos.find((t) => t.id === terminoId)
  if (!termino) {
    throw new ErrorDeDominio('No encontramos ese término.', 'Puede que ya se haya quitado.')
  }

  const existente = repositorio
    .buscarConceptos(termino.termino)
    .find((c) => claveTermino(c.nombre) === claveTermino(termino.termino))

  let destinoId: string
  if (existente) {
    destinoId = existente.id
  } else {
    const nuevo = nuevoConcepto({
      id: slugUnico(termino.termino, new Set(vault.listarIdsConceptos()), 'concepto'),
      nombre: termino.termino,
      // La definición pasa a ser su descripción: no se pierde lo escrito.
      descripcion: termino.definicion
    })
    vault.guardarConcepto(nuevo)
    repositorio.indexarConcepto(nuevo)
    destinoId = nuevo.id
  }

  // Se relaciona y se quita del glosario en el mismo paso: el término ya no
  // vive en dos sitios a la vez.
  const origen = relacionarCon(
    quitarTermino(concepto, terminoId),
    crearRelacion({ destino: destinoId, tipo: 'relacionado_con' })
  )
  return {
    concepto: guardar(servicios, origen),
    conceptoId: destinoId,
    nombre: termino.termino,
    creado: existente === undefined
  }
}
