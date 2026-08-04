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
  /** Salta a una de las pestañas abiertas (recorta la pila hasta ahí). */
  irA: (indice: number) => void
  /** Cierra una pestaña concreta. */
  cerrarUna: (indice: number) => void
  cerrar: () => void

  /**
   * Cómo llevar algo de un concepto al lienzo. Lo registra el editor mientras
   * está montado; fuera del lienzo es null y el panel no ofrece la acción.
   *
   * Vive en el store porque el panel es global (cuelga de App) y el editor es
   * una pantalla: no hay forma de pasarle una prop sin subir el estado del
   * lienzo a toda la aplicación.
   */
  llevarAlLienzo:
    | ((que: {
        tipo: 'concepto' | 'nota' | 'material'
        conceptoId: string
        /** Solo en 'material'. */
        archivo?: string
        /** Solo en 'nota'. */
        notaId?: string
      }) => void)
    | null
  registrarLlevarAlLienzo: (fn: VistazoState['llevarAlLienzo']) => void
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
  irA: (indice) => set((s) => ({ pila: s.pila.slice(0, indice + 1) })),
  cerrarUna: (indice) => set((s) => ({ pila: s.pila.filter((_, i) => i !== indice) })),
  llevarAlLienzo: null,
  registrarLlevarAlLienzo: (fn) => set({ llevarAlLienzo: fn }),
  cerrar: () => set({ pila: [] })
}))
