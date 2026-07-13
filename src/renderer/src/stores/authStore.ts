import { create } from 'zustand'
import type { SesionDTO } from '@shared/dtos'
import { api } from '../lib/api'

interface AuthState {
  sesion: SesionDTO | null
  /** true mientras aún no sabemos si hay sesión (arranque). */
  cargando: boolean
  /** true mientras el navegador está abierto esperando el login. */
  iniciando: boolean

  cargar: () => Promise<void>
  iniciar: () => Promise<void>
  cerrar: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  sesion: null,
  cargando: true,
  iniciando: false,

  cargar: async () => {
    try {
      const sesion = await api.sesionActual()
      set({ sesion, cargando: false })
    } catch {
      set({ sesion: null, cargando: false })
    }
  },

  iniciar: async () => {
    set({ iniciando: true })
    try {
      const sesion = await api.iniciarSesion()
      set({ sesion, iniciando: false })
    } catch (error) {
      set({ iniciando: false })
      throw error
    }
  },

  cerrar: async () => {
    await api.cerrarSesion()
    set({ sesion: null })
  }
}))
