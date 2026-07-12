import { create } from 'zustand'
import type { ResumenAsignaturaDTO } from '@shared/dtos'
import { api } from '../lib/api'
import { useUiStore } from './uiStore'

interface AsignaturasState {
  lista: ResumenAsignaturaDTO[]
  cargar: () => Promise<void>
}

export const useAsignaturasStore = create<AsignaturasState>((set) => ({
  lista: [],
  cargar: async () => {
    try {
      set({ lista: await api.listarAsignaturas() })
    } catch (error) {
      useUiStore.getState().notificarError(error)
    }
  }
}))
