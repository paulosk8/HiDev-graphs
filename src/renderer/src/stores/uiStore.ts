import { create } from 'zustand'
import { ErrorAmigableError } from '../lib/api'

export type Seccion =
  | 'conceptos'
  | 'asignaturas'
  | 'grafo'
  | 'asistente'
  | 'terminal'
  | 'configuracion'
  | 'estudio'

/**
 * Contexto de trabajo: separa la capa de docencia (asignaturas) de la de
 * aprendizaje (espacios de estudio). Las secciones asignaturas/conceptos/grafo
 * se filtran según el contexto activo; 'asistente' es transversal. Los conceptos
 * siguen siendo un único pool compartido: el contexto solo filtra qué se ve.
 */
export type Contexto = 'docencia' | 'aprendizaje'

/**
 * Petición pendiente de la interfaz ("abre el formulario de concepto nuevo").
 * La lanza quien no puede abrir el formulario directamente —la barra de menú
 * del sistema— y la recoge la pantalla correspondiente cuando se monta.
 */
export type Intencion = 'nuevo-concepto' | 'nueva-asignatura'

export type TipoAviso = 'exito' | 'error' | 'info'

export interface Aviso {
  id: number
  tipo: TipoAviso
  mensaje: string
  sugerencia?: string
}

interface UiState {
  seccion: Seccion
  contexto: Contexto
  conceptoSeleccionadoId: string | null
  asignaturaSeleccionadaId: string | null
  avisos: Aviso[]
  /** Formulario que hay que abrir en cuanto la pantalla que lo tiene esté lista. */
  intencion: Intencion | null

  /** Navega a una sección; si se indica, cambia también el contexto (docencia/aprendizaje). */
  irASeccion: (seccion: Seccion, contexto?: Contexto) => void
  /** Abre Configuración; si ya está abierta, vuelve a la vista anterior (toggle). */
  alternarConfiguracion: () => void
  seleccionarConcepto: (id: string | null) => void
  /**
   * Etiqueta por la que está filtrado el listado de conceptos, o null.
   * Vive aquí y no en el listado porque se fija desde OTRA pantalla (al pulsar
   * un chip en la ficha de un concepto), y el listado la recoge al montarse.
   */
  etiquetaFiltrada: string | null
  filtrarPorEtiqueta: (etiqueta: string | null) => void
  seleccionarAsignatura: (id: string | null) => void
  /** Pide abrir un formulario (lo atiende la pantalla correspondiente). */
  pedirIntencion: (intencion: Intencion) => void
  /** La pantalla marca la petición como atendida. */
  limpiarIntencion: () => void

  notificar: (aviso: Omit<Aviso, 'id'>) => void
  /** Traduce un error capturado a un aviso humano (mensaje + sugerencia). */
  notificarError: (error: unknown) => void
  descartarAviso: (id: number) => void
}

let secuenciaAviso = 0

// Vista a la que volver al cerrar Configuración (se recuerda al abrirla).
let vistaPrevia: { seccion: Seccion; contexto: Contexto } = {
  seccion: 'asignaturas',
  contexto: 'docencia'
}

export const useUiStore = create<UiState>((set) => ({
  // Al arrancar (tras iniciar sesión) se muestran las asignaturas de docencia.
  seccion: 'asignaturas',
  contexto: 'docencia',
  conceptoSeleccionadoId: null,
  asignaturaSeleccionadaId: null,
  avisos: [],
  intencion: null,

  irASeccion: (seccion, contexto) =>
    set((estado) => ({
      seccion,
      contexto: contexto ?? estado.contexto,
      conceptoSeleccionadoId: null,
      asignaturaSeleccionadaId: null
    })),

  alternarConfiguracion: () =>
    set((estado) => {
      if (estado.seccion === 'configuracion') {
        // Ya está abierta: vuelve a la vista anterior (oculta las opciones).
        return {
          seccion: vistaPrevia.seccion,
          contexto: vistaPrevia.contexto,
          conceptoSeleccionadoId: null,
          asignaturaSeleccionadaId: null
        }
      }
      // Recuerda desde dónde se abrió para poder regresar al cerrarla.
      vistaPrevia = { seccion: estado.seccion, contexto: estado.contexto }
      return {
        seccion: 'configuracion',
        conceptoSeleccionadoId: null,
        asignaturaSeleccionadaId: null
      }
    }),
  seleccionarConcepto: (id) => set({ conceptoSeleccionadoId: id }),
  etiquetaFiltrada: null,
  filtrarPorEtiqueta: (etiqueta) => set({ etiquetaFiltrada: etiqueta }),
  seleccionarAsignatura: (id) => set({ asignaturaSeleccionadaId: id }),

  pedirIntencion: (intencion) => set({ intencion }),
  limpiarIntencion: () => set({ intencion: null }),

  notificar: (aviso) =>
    set((estado) => ({ avisos: [...estado.avisos, { ...aviso, id: ++secuenciaAviso }] })),

  notificarError: (error) => {
    const mensaje = error instanceof Error ? error.message : 'Ocurrió un problema inesperado.'
    const sugerencia = error instanceof ErrorAmigableError ? error.sugerencia : undefined
    set((estado) => ({
      avisos: [...estado.avisos, { id: ++secuenciaAviso, tipo: 'error', mensaje, sugerencia }]
    }))
  },

  descartarAviso: (id) =>
    set((estado) => ({ avisos: estado.avisos.filter((a) => a.id !== id) }))
}))
