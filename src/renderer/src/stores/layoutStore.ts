import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Altura por defecto (px) al abrir la terminal del Mapa de conceptos. */
export const ALTURA_TERMINAL_DEFECTO = 300

export type Tema = 'claro' | 'oscuro'

interface LayoutState {
  /** Menú lateral en modo franja de iconos (sin texto). */
  sidebarColapsada: boolean
  /** Panel derecho del grafo en modo franja de puntos de color. */
  panelGrafoColapsado: boolean
  /** Altura de la terminal del grafo en px (0 = cerrada). */
  terminalAltura: number
  /** Tema de la interfaz (claro u oscuro). */
  tema: Tema
  /** Grupo «Docencia» del menú plegado (oculta sus sub-ítems). */
  docenciaColapsada: boolean
  /** Grupo «Aprendizaje» del menú plegado. */
  aprendizajeColapsada: boolean

  alternarSidebar: () => void
  alternarPanelGrafo: () => void
  setTerminalAltura: (px: number) => void
  alternarTerminal: () => void
  alternarTema: () => void
  alternarGrupo: (grupo: 'docencia' | 'aprendizaje') => void
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
      tema: 'claro',
      docenciaColapsada: false,
      aprendizajeColapsada: false,

      alternarSidebar: () => set((s) => ({ sidebarColapsada: !s.sidebarColapsada })),
      alternarPanelGrafo: () => set((s) => ({ panelGrafoColapsado: !s.panelGrafoColapsado })),
      setTerminalAltura: (px) => set({ terminalAltura: Math.max(0, Math.round(px)) }),
      alternarTerminal: () =>
        set((s) => ({ terminalAltura: s.terminalAltura > 0 ? 0 : ALTURA_TERMINAL_DEFECTO })),
      alternarTema: () => set((s) => ({ tema: s.tema === 'oscuro' ? 'claro' : 'oscuro' })),
      alternarGrupo: (grupo) =>
        set((s) =>
          grupo === 'docencia'
            ? { docenciaColapsada: !s.docenciaColapsada }
            : { aprendizajeColapsada: !s.aprendizajeColapsada }
        )
    }),
    { name: 'pedagograph-layout' }
  )
)
