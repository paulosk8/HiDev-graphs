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
  /** Sincroniza con la nube y recarga las vistas. Devuelve el resumen o null si falló. */
  sincronizar: () => Promise<SincronizacionDTO | null>
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
      // Al arrancar con sesión, sincroniza en segundo plano (no bloquea la app).
      if (sesion) void get().sincronizar()
    } catch {
      set({ sesion: null, cargando: false })
    }
  },

  iniciar: async () => {
    set({ iniciando: true })
    try {
      const sesion = await api.iniciarSesion()
      set({ sesion, iniciando: false })
      void get().sincronizar()
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
      // Si bajó algo de la nube, refresca las vistas.
      if (resumen.bajados > 0) {
        await Promise.all([
          useConceptosStore.getState().cargar(),
          useAsignaturasStore.getState().cargar()
        ])
      }
      return resumen
    } catch {
      // Sin conexión u otro problema: la app sigue con la copia local.
      return null
    } finally {
      set({ sincronizando: false })
    }
  }
}))
