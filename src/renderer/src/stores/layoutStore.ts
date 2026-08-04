import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Altura por defecto (px) al abrir la terminal del Mapa de conceptos. */
export const ALTURA_TERMINAL_DEFECTO = 300

/**
 * Temas de la interfaz. Además de claro y oscuro hay dos de **alto contraste**
 * y uno **cálido**, pensados para docentes con vista cansada o fatiga visual:
 * la mayoría de los grises "decorativos" de la interfaz quedan por debajo del
 * contraste mínimo recomendado (WCAG AA) y son justo los que dejan de leerse
 * con la edad. El cálido baja el blanco puro, que es lo que más deslumbra.
 */
export type Tema = 'claro' | 'oscuro' | 'contraste' | 'contraste-oscuro' | 'calido'

/** Los temas oscuros, para saber cuándo aplicar la clase `dark`. */
export const TEMAS_OSCUROS: readonly Tema[] = ['oscuro', 'contraste-oscuro']

export interface OpcionTemaInfo {
  clave: Tema
  nombre: string
  descripcion: string
}

/** Catálogo para la pantalla de Apariencia, en el orden en que se ofrece. */
export const TEMAS: readonly OpcionTemaInfo[] = [
  { clave: 'claro', nombre: 'Claro', descripcion: 'El de siempre.' },
  { clave: 'calido', nombre: 'Cálido', descripcion: 'Fondo crema. Cansa menos la vista en sesiones largas.' },
  {
    clave: 'contraste',
    nombre: 'Alto contraste',
    descripcion: 'Texto más oscuro y bordes marcados. La opción si te cuesta leer los grises.'
  },
  { clave: 'oscuro', nombre: 'Oscuro', descripcion: 'Fondo oscuro, cómodo de noche.' },
  {
    clave: 'contraste-oscuro',
    nombre: 'Oscuro de alto contraste',
    descripcion: 'Fondo negro y texto blanco, al máximo de nitidez.'
  }
]

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
  /** Fija el tema desde la pantalla de Apariencia. */
  setTema: (tema: Tema) => void
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
      // El interruptor del menú lateral solo alterna claro/oscuro, pero respeta
      // el alto contraste si el docente ya lo eligió: apagar la luz no debería
      // deshacer un ajuste de accesibilidad.
      alternarTema: () =>
        set((s) => {
          const contraste = s.tema === 'contraste' || s.tema === 'contraste-oscuro'
          const esOscuro = TEMAS_OSCUROS.includes(s.tema)
          if (contraste) return { tema: esOscuro ? 'contraste' : 'contraste-oscuro' }
          return { tema: esOscuro ? 'claro' : 'oscuro' }
        }),
      setTema: (tema) => set({ tema }),
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
