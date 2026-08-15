import { randomUUID } from 'node:crypto'
import type { ConceptoDTO, DatosEnlaceMaterialDTO } from '../../shared/dtos'
import {
  actualizarEnlace,
  agregarEnlace,
  moverEnlaceACarpeta as moverEnlaceEnConcepto,
  quitarEnlace
} from '../domain/Concepto'
import { crearEnlaceMaterial } from '../domain/EnlaceMaterial'
import { ErrorDeDominio, exigir } from '../domain/errores'
import type { Concepto } from '../domain/Concepto'
import type { Servicios } from '../servicios'
import { aConceptoDTO } from './mapeadores'

/**
 * Enlaces web del material de un concepto.
 *
 * A diferencia de un archivo, aquí no hay nada que copiar al vault: el enlace
 * vive entero en `concepto.yaml`. Por eso estos casos de uso son solo
 * "leer → cambiar → guardar → reindexar", sin el paso previo de tocar el disco
 * que sí tienen `AgregarMaterial` y `CarpetasMaterial`.
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

export function agregarEnlaceMaterial(
  servicios: Servicios,
  conceptoId: string,
  datos: DatosEnlaceMaterialDTO
): ConceptoDTO {
  const concepto = leerConceptoExistente(servicios, conceptoId)
  const enlace = crearEnlaceMaterial({
    id: randomUUID(),
    titulo: datos.titulo,
    url: datos.url,
    carpeta: datos.carpeta ?? ''
  })
  return guardar(servicios, agregarEnlace(concepto, enlace))
}

export function editarEnlaceMaterial(
  servicios: Servicios,
  conceptoId: string,
  enlaceId: string,
  datos: DatosEnlaceMaterialDTO
): ConceptoDTO {
  const concepto = leerConceptoExistente(servicios, conceptoId)
  const actual = concepto.enlaces.find((e) => e.id === enlaceId)
  exigir(actual !== undefined, 'No encontramos ese enlace.')

  const enlace = crearEnlaceMaterial({
    id: enlaceId,
    titulo: datos.titulo,
    url: datos.url,
    // La carpeta no se edita en el formulario: se cambia arrastrando o desde
    // "Mover a otra carpeta", así que se conserva la que tenía.
    carpeta: datos.carpeta ?? actual!.carpeta
  })
  return guardar(servicios, actualizarEnlace(concepto, enlace))
}

export function eliminarEnlaceMaterial(
  servicios: Servicios,
  conceptoId: string,
  enlaceId: string
): ConceptoDTO {
  const concepto = leerConceptoExistente(servicios, conceptoId)
  exigir(
    concepto.enlaces.some((e) => e.id === enlaceId),
    'No encontramos ese enlace.'
  )
  // No pasa por la papelera: no hay archivo que recuperar, solo una dirección.
  return guardar(servicios, quitarEnlace(concepto, enlaceId))
}

export function moverEnlaceACarpeta(
  servicios: Servicios,
  conceptoId: string,
  enlaceId: string,
  carpetaDestino: string
): ConceptoDTO {
  const concepto = leerConceptoExistente(servicios, conceptoId)
  const enlace = concepto.enlaces.find((e) => e.id === enlaceId)
  exigir(enlace !== undefined, 'No encontramos ese enlace.')
  if (enlace!.carpeta === carpetaDestino) return aConceptoDTO(concepto)

  return guardar(servicios, moverEnlaceEnConcepto(concepto, enlaceId, carpetaDestino))
}
