import { create } from 'zustand'

/**
 * Panel de vistazo: mirar un concepto enlazado SIN salir de donde estás.
 *
 * El problema que resuelve: si un enlace `[[Interfaz]]` te llevara a la ficha
 * de "Interfaz", perderías la nota que estabas leyendo y tendrías que volver.
 * Leyendo material de estudio eso pasa cada dos líneas.
 *
 * Es una PILA, no un solo concepto: desde el vistazo puedes pulsar otro enlace
 * y seguir tirando del hilo, con "volver" deshaciendo paso a paso. Es la
 * diferencia entre consultar y perderse.
 */
interface VistazoState {
  /** Conceptos abiertos, el último es el que se ve. Vacío = panel cerrado. */
  pila: string[]
  abrir: (conceptoId: string) => void
  volver: () => void
  cerrar: () => void
}

export const useVistazoStore = create<VistazoState>((set) => ({
  pila: [],
  abrir: (conceptoId) =>
    set((s) => {
      // Pulsar el que ya estás viendo no debe apilar un duplicado.
      if (s.pila[s.pila.length - 1] === conceptoId) return s
      return { pila: [...s.pila, conceptoId] }
    }),
  volver: () => set((s) => ({ pila: s.pila.slice(0, -1) })),
  cerrar: () => set({ pila: [] })
}))
