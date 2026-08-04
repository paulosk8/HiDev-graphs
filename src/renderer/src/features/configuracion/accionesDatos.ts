import { api } from '../../lib/api'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'

/**
 * Acciones sobre los datos del docente (actualizar, copia de seguridad,
 * restaurar) escritas fuera de React: las usan tanto los botones de
 * Configuración → Datos y copias como la barra de menú del sistema, para que
 * ambos caminos hagan exactamente lo mismo y avisen igual.
 */

/** Vuelve a leer conceptos y asignaturas tras una operación que toca el material. */
async function recargarTodo(): Promise<void> {
  await Promise.all([
    useConceptosStore.getState().cargar(),
    useAsignaturasStore.getState().cargar()
  ])
}

const plural = (n: number, singular: string, plural: string): string =>
  `${n} ${n === 1 ? singular : plural}`

/** Reindexa el material desde el disco y refresca la interfaz. */
export async function actualizarMaterial(): Promise<void> {
  const { notificar, notificarError } = useUiStore.getState()
  try {
    const r = await api.reindexar()
    await recargarTodo()
    notificar({
      tipo: 'exito',
      mensaje: `Todo actualizado: ${plural(r.conceptos, 'concepto', 'conceptos')} y ${plural(r.asignaturas, 'asignatura', 'asignaturas')}.`
    })
  } catch (error) {
    notificarError(error)
  }
}

/** Guarda todo el material en un único archivo comprimido (el sistema pregunta dónde). */
export async function respaldarMaterial(): Promise<void> {
  const { notificar, notificarError } = useUiStore.getState()
  try {
    const r = await api.respaldar()
    if (!r.cancelado) notificar({ tipo: 'exito', mensaje: 'Copia de seguridad guardada.' })
  } catch (error) {
    notificarError(error)
  }
}

/** Recupera el material desde un archivo de copia (el sistema pregunta cuál). */
export async function restaurarMaterial(): Promise<void> {
  const { notificar, notificarError } = useUiStore.getState()
  try {
    const r = await api.restaurar()
    if (!r.cancelado) {
      await recargarTodo()
      notificar({
        tipo: 'exito',
        mensaje: `Copia restaurada: ${plural(r.conceptos ?? 0, 'concepto', 'conceptos')}, ${plural(r.asignaturas ?? 0, 'asignatura', 'asignaturas')} y ${plural(r.tareas ?? 0, 'tarea', 'tareas')}.`
      })
    }
  } catch (error) {
    notificarError(error)
  }
}
