import { create } from 'zustand'
import type { ConflictoDTO, EleccionConflicto } from '@shared/dtos'
import { api } from '../lib/api'
import { useConceptosStore } from './conceptosStore'
import { useAsignaturasStore } from './asignaturasStore'

interface ConflictosState {
  lista: ConflictoDTO[]
  cargando: boolean
  /** `${tabla}:${id}` del conflicto que se está resolviendo (o null). */
  resolviendo: string | null

  /** Carga la lista de conflictos pendientes (silenciosa: no molesta si falla). */
  cargar: () => Promise<void>
  /** Resuelve un conflicto; lanza si falla (para mostrar el error). */
  resolver: (tabla: ConflictoDTO['tabla'], id: string, eleccion: EleccionConflicto) => Promise<void>
}

export const useConflictosStore = create<ConflictosState>((set, get) => ({
  lista: [],
  cargando: false,
  resolviendo: null,

  cargar: async () => {
    set({ cargando: true })
    try {
      set({ lista: await api.listarConflictos() })
    } catch {
      /* sin conexión o error puntual: se conserva la lista actual */
    } finally {
      set({ cargando: false })
    }
  },

  resolver: async (tabla, id, eleccion) => {
    set({ resolviendo: `${tabla}:${id}` })
    try {
      await api.resolverConflicto(tabla, id, eleccion)
      // Se aplicó en ambos lados y cambió lo local: refresca conflictos y vistas.
      await get().cargar()
      await Promise.all([
        useConceptosStore.getState().cargar(),
        useAsignaturasStore.getState().cargar()
      ])
    } finally {
      set({ resolviendo: null })
    }
  }
}))
