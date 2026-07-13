import { create } from 'zustand'
import { ErrorAmigableError } from '../lib/api'

export type Seccion = 'conceptos' | 'asignaturas' | 'grafo' | 'asistente' | 'terminal'

export type TipoAviso = 'exito' | 'error' | 'info'

export interface Aviso {
  id: number
  tipo: TipoAviso
  mensaje: string
  sugerencia?: string
}

interface UiState {
  seccion: Seccion
  conceptoSeleccionadoId: string | null
  asignaturaSeleccionadaId: string | null
  avisos: Aviso[]

  irASeccion: (seccion: Seccion) => void
  seleccionarConcepto: (id: string | null) => void
  seleccionarAsignatura: (id: string | null) => void

  notificar: (aviso: Omit<Aviso, 'id'>) => void
  /** Traduce un error capturado a un aviso humano (mensaje + sugerencia). */
  notificarError: (error: unknown) => void
  descartarAviso: (id: number) => void
}

let secuenciaAviso = 0

export const useUiStore = create<UiState>((set) => ({
  // Al arrancar (tras iniciar sesión) se muestra "Mis asignaturas".
  seccion: 'asignaturas',
  conceptoSeleccionadoId: null,
  asignaturaSeleccionadaId: null,
  avisos: [],

  irASeccion: (seccion) =>
    set({ seccion, conceptoSeleccionadoId: null, asignaturaSeleccionadaId: null }),
  seleccionarConcepto: (id) => set({ conceptoSeleccionadoId: id }),
  seleccionarAsignatura: (id) => set({ asignaturaSeleccionadaId: id }),

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
