import { create } from 'zustand'
import type { SesionDTO, SincronizacionDTO } from '@shared/dtos'
import { api } from '../lib/api'
import { useConceptosStore } from './conceptosStore'
import { useAsignaturasStore } from './asignaturasStore'

interface AuthState {
  sesion: SesionDTO | null
  /** true mientras aún no sabemos si hay sesión (arranque). */
  cargando: boolean
  /** true mientras el navegador está abierto esperando el login. */
  iniciando: boolean
  /** true mientras se sincroniza con la nube. */
  sincronizando: boolean

  cargar: () => Promise<void>
  iniciar: () => Promise<void>
  cerrar: () => Promise<void>
  /** Sincroniza con la nube y recarga las vistas. Lanza si falla (para mostrar el error). */
  sincronizar: () => Promise<SincronizacionDTO>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  sesion: null,
  cargando: true,
  iniciando: false,
  sincronizando: false,

  cargar: async () => {
    try {
      const sesion = await api.sesionActual()
      set({ sesion, cargando: false })
      // Al arrancar con sesión, sincroniza en segundo plano (los errores no molestan).
      if (sesion) void get().sincronizar().catch(() => undefined)
    } catch {
      set({ sesion: null, cargando: false })
    }
  },

  iniciar: async () => {
    set({ iniciando: true })
    try {
      const sesion = await api.iniciarSesion()
      set({ sesion, iniciando: false })
      void get().sincronizar().catch(() => undefined)
    } catch (error) {
      set({ iniciando: false })
      throw error
    }
  },

  cerrar: async () => {
    await api.cerrarSesion()
    set({ sesion: null })
  },

  sincronizar: async () => {
    set({ sincronizando: true })
    try {
      const resumen = await api.sincronizarNube()
      // Si el vault local cambió (bajó o se borró algo), refresca las vistas.
      if (resumen.bajados > 0 || resumen.borradosLocal > 0) {
        await Promise.all([
          useConceptosStore.getState().cargar(),
          useAsignaturasStore.getState().cargar()
        ])
      }
      return resumen
    } finally {
      set({ sincronizando: false })
    }
  }
}))
