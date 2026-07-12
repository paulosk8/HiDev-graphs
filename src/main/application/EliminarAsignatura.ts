import { ErrorDeDominio } from '../domain/errores'
import type { Servicios } from '../servicios'

/**
 * Elimina una asignatura: borra su carpeta del vault y la quita del índice
 * junto con toda su jerarquía. No afecta a los conceptos ni a su material
 * (viven en la capa de conocimiento).
 */
export function eliminarAsignatura(servicios: Servicios, id: string): void {
  const { vault, repositorio } = servicios

  if (!vault.existeAsignatura(id)) {
    throw new ErrorDeDominio('No encontramos esa asignatura.', 'Puede que ya se haya eliminado.')
  }

  // Borra también las tareas de esta asignatura (no dejan sentido sin ella).
  for (const tarea of vault.leerTodasTareas()) {
    if (tarea.asignaturaId === id) vault.eliminarTarea(tarea.id)
  }

  vault.eliminarAsignatura(id)
  repositorio.eliminarAsignatura(id)
}
