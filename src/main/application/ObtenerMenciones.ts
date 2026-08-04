import type { ResumenMencionDTO } from '../../shared/dtos'
import { mencionaA } from '../domain/enlaces'
import { ErrorDeDominio } from '../domain/errores'
import type { Servicios } from '../servicios'

/**
 * "Se menciona en": qué OTROS conceptos enlazan a este desde sus notas con
 * `[[Nombre]]`. Es el reverso del enlace, y lo que evita que una nota escrita
 * hace meses quede huérfana.
 *
 * Se resuelve escaneando el vault y no el índice SQLite a propósito: el enlace
 * vive DENTRO del texto de la nota, así que mantenerlo indexado obligaría a
 * re-escanear en cada tecla. Los conceptos son pocos y sus notas ya están en
 * disco; escanear al abrir la ficha es más simple y siempre está al día.
 */
export function obtenerMenciones(servicios: Servicios, conceptoId: string): ResumenMencionDTO[] {
  const { vault } = servicios

  if (!vault.existeConcepto(conceptoId)) {
    throw new ErrorDeDominio('No encontramos ese concepto.', 'Puede que ya se haya eliminado.')
  }
  const objetivo = vault.leerConcepto(conceptoId)

  return vault
    .leerTodosConceptos()
    .filter((c) => c.id !== objetivo.id)
    .filter((c) => c.notas.some((n) => mencionaA(n.contenido, objetivo.nombre)))
    .map((c) => ({ id: c.id, nombre: c.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}
