import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Altura por defecto (px) al abrir la terminal del Mapa de conceptos. */
export const ALTURA_TERMINAL_DEFECTO = 300

export type Tema = 'claro' | 'oscuro'

/** Límites del zoom: por debajo no se lee, por encima no cabe la interfaz. */
export const ZOOM_MIN = 70
export const ZOOM_MAX = 180
/** Escalón de cada pulsación, en puntos porcentuales. */
export const PASO_ZOOM = 10

function acotarZoom(porcentaje: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(porcentaje)))
}

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

  /** Capa de Docencia habilitada en la interfaz (asignaturas + su material). */
  capaDocencia: boolean
  /** Capa de Aprendizaje habilitada (espacios de estudio y repaso). */
  capaAprendizaje: boolean
  /** true cuando el docente ya eligió sus capas en la bienvenida. */
  capasElegidas: boolean

  /**
   * Tamaño de toda la interfaz, en porcentaje (100 = normal). Equivale a los
   * atajos ⌘+ / ⌘− del menú, pero visible y recordado entre sesiones: un
   * docente que no conoce el atajo no debería quedarse con la letra pequeña.
   */
  zoomPorcentaje: number

  alternarSidebar: () => void
  alternarPanelGrafo: () => void
  setTerminalAltura: (px: number) => void
  alternarTerminal: () => void
  alternarTema: () => void
  /** Fija el tamaño de la interfaz, acotado a un rango legible y usable. */
  setZoom: (porcentaje: number) => void
  /** Sube o baja un escalón (los mismos pasos que ⌘+ / ⌘−). */
  ajustarZoom: (pasos: number) => void
  alternarGrupo: (grupo: 'docencia' | 'aprendizaje') => void
  /**
   * Fija qué capas se muestran (bienvenida y Configuración). Ignora la llamada
   * si ambas quedaran desactivadas (siempre debe quedar al menos una).
   */
  elegirCapas: (docencia: boolean, aprendizaje: boolean) => void
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
      capaDocencia: true,
      capaAprendizaje: true,
      capasElegidas: false,
      zoomPorcentaje: 100,

      setZoom: (porcentaje) => set({ zoomPorcentaje: acotarZoom(porcentaje) }),
      ajustarZoom: (pasos) =>
        set((s) => ({ zoomPorcentaje: acotarZoom(s.zoomPorcentaje + pasos * PASO_ZOOM) })),

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
        ),
      elegirCapas: (docencia, aprendizaje) =>
        set(() =>
          docencia || aprendizaje
            ? { capaDocencia: docencia, capaAprendizaje: aprendizaje, capasElegidas: true }
            : {}
        )
    }),
    { name: 'pedagograph-layout' }
  )
)
