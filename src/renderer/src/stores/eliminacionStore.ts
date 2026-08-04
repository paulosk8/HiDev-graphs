import { create } from 'zustand'
import type { ModoEliminacion } from '@shared/dtos'
import { api } from '../lib/api'

/**
 * Preferencia de eliminación, cacheada en el renderer.
 *
 * Existe para una sola cosa: que los diálogos de "¿Seguro que quieres
 * eliminar?" digan la verdad. Con la papelera activada, "esta acción no se
 * puede deshacer" sería mentira, y el docente no técnico se guía por ese texto.
 * Se carga una vez al arrancar y se refresca al cambiar la preferencia.
 */
interface EliminacionState {
  modo: ModoEliminacion
  cargar: () => Promise<void>
  fijar: (modo: ModoEliminacion) => void
}

export const useEliminacionStore = create<EliminacionState>((set) => ({
  // Se asume la opción segura hasta saber la real: nunca prometemos que algo
  // es irreversible cuando quizá no lo sea.
  modo: 'papelera',
  cargar: async () => {
    try {
      const estado = await api.estadoEliminacion()
      set({ modo: estado.modo })
    } catch {
      // Si falla, se queda el valor por defecto: es solo texto informativo.
    }
  },
  fijar: (modo) => set({ modo })
}))

/**
 * Segunda frase de los diálogos de eliminación, según la preferencia. Se usa en
 * todas las confirmaciones para no repetir (ni desincronizar) el mismo aviso.
 */
export function avisoDeEliminacion(modo: ModoEliminacion): string {
  return modo === 'papelera'
    ? 'Podrás recuperarlo desde la carpeta de eliminados.'
    : 'Esta acción no se puede deshacer.'
}
