import type { ConceptoDTO } from '../../shared/dtos'
import { crearConcepto } from '../domain/Concepto'
import { carpetaDe, crearRecurso, rutaEnCarpeta } from '../domain/Recurso'
import { ErrorDeDominio, exigir } from '../domain/errores'
import type { Servicios } from '../servicios'
import { aConceptoDTO } from './mapeadores'

/**
 * Carpetas de material dentro de un concepto.
 *
 * Son carpetas REALES en disco, así que el docente ve la misma organización
 * desde OneDrive o el Finder. Eso obliga a mantener sincronizados el archivo
 * físico y su registro en el YAML: mover uno sin el otro dejaría material
 * huérfano.
 */

function leerConceptoExistente(servicios: Servicios, conceptoId: string) {
  if (!servicios.vault.existeConcepto(conceptoId)) {
    throw new ErrorDeDominio('No encontramos ese concepto.', 'Puede que ya se haya eliminado.')
  }
  return servicios.vault.leerConcepto(conceptoId)
}

/** Carpetas existentes en un concepto (leídas del disco). */
export function listarCarpetas(servicios: Servicios, conceptoId: string): string[] {
  leerConceptoExistente(servicios, conceptoId)
  return servicios.vault.listarCarpetasConcepto(conceptoId)
}

/** Crea una carpeta vacía. Devuelve la lista actualizada. */
export function crearCarpeta(servicios: Servicios, conceptoId: string, nombre: string): string[] {
  leerConceptoExistente(servicios, conceptoId)
  try {
    servicios.vault.crearCarpetaConcepto(conceptoId, nombre)
  } catch {
    throw new ErrorDeDominio(
      'Ese nombre de carpeta no se puede usar.',
      'Evita los caracteres \\ / : * ? " < > | y prueba otro nombre.'
    )
  }
  return servicios.vault.listarCarpetasConcepto(conceptoId)
}

/**
 * Cambia el nombre de una carpeta.
 *
 * La carpeta es real en disco y su nombre va dentro de `Recurso.archivo`
 * ("Lecturas/paper.pdf"), así que renombrarla obliga a reescribir las rutas de
 * su material y la etiqueta de sus enlaces. Se mueve el directorio PRIMERO: si
 * eso falla, el YAML no se toca y nada queda apuntando a una carpeta que no
 * existe.
 */
export function renombrarCarpeta(
  servicios: Servicios,
  conceptoId: string,
  actual: string,
  nuevo: string
): ConceptoDTO {
  const { vault, repositorio } = servicios
  const concepto = leerConceptoExistente(servicios, conceptoId)

  let destino: string
  try {
    destino = vault.renombrarCarpetaConcepto(conceptoId, actual, nuevo)
  } catch (error) {
    // Cada motivo pide una salida distinta: si el nombre está cogido no sirve
    // de nada hablarle de caracteres raros.
    if (error instanceof Error && error.message.startsWith('Ya existe')) {
      throw new ErrorDeDominio(
        error.message,
        'Elige otro nombre, o mueve su material a esa carpeta si querías juntarlos.'
      )
    }
    throw new ErrorDeDominio(
      'Ese nombre de carpeta no se puede usar.',
      'Evita los caracteres \\ / : * ? " < > | y prueba otro nombre.'
    )
  }
  if (destino === actual) return aConceptoDTO(concepto)

  const actualizado = crearConcepto({
    ...concepto,
    recursos: concepto.recursos.map((r) =>
      carpetaDe(r.archivo) === actual
        ? crearRecurso({ ...r, archivo: rutaEnCarpeta(destino, r.archivo) })
        : r
    ),
    enlaces: concepto.enlaces.map((e) => (e.carpeta === actual ? { ...e, carpeta: destino } : e))
  })

  vault.guardarConcepto(actualizado)
  repositorio.indexarConcepto(actualizado)
  return aConceptoDTO(actualizado)
}

/**
 * Quita una carpeta y deja suelto lo que tuviera dentro.
 *
 * **No borra material.** Una carpeta es una forma de ordenar, no un contenedor
 * del que dependa el contenido: quitarla no debería costarle al docente los
 * PDF que le metió. Para eliminar material está el ✕ de cada fila, que sí pasa
 * por la papelera.
 */
export function eliminarCarpeta(
  servicios: Servicios,
  conceptoId: string,
  nombre: string
): ConceptoDTO {
  const { vault, repositorio } = servicios
  const concepto = leerConceptoExistente(servicios, conceptoId)

  // Primero los archivos, uno a uno: `moverRecursoDeCarpeta` ya resuelve las
  // colisiones de nombre con lo que hubiera suelto en la raíz.
  const recursos = concepto.recursos.map((r) => {
    if (carpetaDe(r.archivo) !== nombre) return r
    const nuevaRuta = vault.moverRecursoDeCarpeta(conceptoId, r.archivo, '')
    return crearRecurso({ ...r, archivo: nuevaRuta })
  })

  // Ya vacía en disco (los enlaces no ocupan nada ahí): se puede quitar.
  vault.eliminarCarpetaConcepto(conceptoId, nombre)

  const actualizado = crearConcepto({
    ...concepto,
    recursos,
    enlaces: concepto.enlaces.map((e) => (e.carpeta === nombre ? { ...e, carpeta: '' } : e))
  })

  vault.guardarConcepto(actualizado)
  repositorio.indexarConcepto(actualizado)
  return aConceptoDTO(actualizado)
}

/**
 * Mueve un material a otra carpeta del mismo concepto (carpeta vacía = raíz).
 * Mueve el archivo Y actualiza su registro, en ese orden: si el movimiento
 * físico falla, el YAML no se toca y nada queda descuadrado.
 */
export function moverMaterialACarpeta(
  servicios: Servicios,
  conceptoId: string,
  recursoId: string,
  carpetaDestino: string
): ConceptoDTO {
  const { vault, repositorio } = servicios
  const concepto = leerConceptoExistente(servicios, conceptoId)

  const recurso = concepto.recursos.find((r) => r.id === recursoId)
  exigir(recurso !== undefined, 'No encontramos ese material.')

  const nuevaRuta = vault.moverRecursoDeCarpeta(conceptoId, recurso!.archivo, carpetaDestino)
  if (nuevaRuta === recurso!.archivo) return aConceptoDTO(concepto)

  const actualizado = crearConcepto({
    ...concepto,
    recursos: concepto.recursos.map((r) =>
      r.id === recursoId ? crearRecurso({ ...r, archivo: nuevaRuta }) : r
    )
  })

  vault.guardarConcepto(actualizado)
  repositorio.indexarConcepto(actualizado)
  return aConceptoDTO(actualizado)
}
