import { ErrorDeDominio } from '../domain/errores'
import type { Servicios } from '../servicios'

/**
 * Elimina un concepto: borra su carpeta del vault (incluido su material) y lo
 * quita del índice. Operación irreversible; la confirmación se pide en la UI.
 */
export function eliminarConcepto(servicios: Servicios, id: string): void {
  const { vault, repositorio } = servicios

  if (!vault.existeConcepto(id)) {
    throw new ErrorDeDominio('No encontramos ese concepto.', 'Puede que ya se haya eliminado.')
  }

  vault.eliminarConcepto(id)
  repositorio.eliminarConcepto(id)
}
