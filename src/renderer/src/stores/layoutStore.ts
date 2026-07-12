import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Altura por defecto (px) al abrir la terminal del Mapa de conceptos. */
export const ALTURA_TERMINAL_DEFECTO = 300

interface LayoutState {
  /** Menú lateral en modo franja de iconos (sin texto). */
  sidebarColapsada: boolean
  /** Panel derecho del grafo en modo franja de puntos de color. */
  panelGrafoColapsado: boolean
  /** Altura de la terminal del grafo en px (0 = cerrada). */
  terminalAltura: number

  alternarSidebar: () => void
  alternarPanelGrafo: () => void
  setTerminalAltura: (px: number) => void
  alternarTerminal: () => void
}

/**
 * Preferencias de disposición de la interfaz. Se guardan en el almacenamiento
 * local del navegador (persist) para que sobrevivan al navegar entre secciones
 * y al reiniciar la app: si ocultas un panel, sigue oculto al volver.
 */
export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarColapsada: false,
      panelGrafoColapsado: false,
      terminalAltura: 0,

      alternarSidebar: () => set((s) => ({ sidebarColapsada: !s.sidebarColapsada })),
      alternarPanelGrafo: () => set((s) => ({ panelGrafoColapsado: !s.panelGrafoColapsado })),
      setTerminalAltura: (px) => set({ terminalAltura: Math.max(0, Math.round(px)) }),
      alternarTerminal: () =>
        set((s) => ({ terminalAltura: s.terminalAltura > 0 ? 0 : ALTURA_TERMINAL_DEFECTO }))
    }),
    { name: 'pedagograph-layout' }
  )
)
