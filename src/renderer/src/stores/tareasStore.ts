import { create } from 'zustand'
import type { DatosTareaDTO, TareaDTO } from '@shared/dtos'
import { api } from '../lib/api'
import { useUiStore } from './uiStore'

const ui = () => useUiStore.getState()

interface TareasState {
  crear: (datos: DatosTareaDTO) => Promise<TareaDTO | null>
  editar: (id: string, datos: DatosTareaDTO) => Promise<TareaDTO | null>
  eliminar: (id: string, titulo: string) => Promise<boolean>
  agregarAdjunto: (id: string, rutas: string[]) => Promise<TareaDTO | null>
  eliminarAdjunto: (id: string, recursoId: string) => Promise<TareaDTO | null>
}

export const useTareasStore = create<TareasState>(() => ({
  crear: async (datos) => {
    try {
      const t = await api.crearTarea(datos)
      ui().notificar({ tipo: 'exito', mensaje: `Tarea «${t.titulo}» creada.` })
      return t
    } catch (error) {
      ui().notificarError(error)
      return null
    }
  },

  editar: async (id, datos) => {
    try {
      const t = await api.editarTarea(id, datos)
      ui().notificar({ tipo: 'exito', mensaje: 'Cambios guardados.' })
      return t
    } catch (error) {
      ui().notificarError(error)
      return null
    }
  },

  eliminar: async (id, titulo) => {
    try {
      await api.eliminarTarea(id)
      ui().notificar({ tipo: 'exito', mensaje: `Tarea «${titulo}» eliminada.` })
      return true
    } catch (error) {
      ui().notificarError(error)
      return false
    }
  },

  agregarAdjunto: async (id, rutas) => {
    try {
      const { tarea, agregados, ignorados } = await api.agregarAdjuntoTarea(id, rutas)
      if (agregados > 0) {
        ui().notificar({
          tipo: 'exito',
          mensaje: agregados === 1 ? 'Adjunto agregado.' : `${agregados} adjuntos agregados.`
        })
      }
      if (ignorados.length > 0) {
        ui().notificar({
          tipo: 'error',
          mensaje: `No se pudo adjuntar: ${ignorados.join(', ')}.`,
          sugerencia: 'Formatos aceptados: PDF, PowerPoint, Word, Markdown, HTML y XML.'
        })
      }
      return tarea
    } catch (error) {
      ui().notificarError(error)
      return null
    }
  },

  eliminarAdjunto: async (id, recursoId) => {
    try {
      const t = await api.eliminarAdjuntoTarea(id, recursoId)
      ui().notificar({ tipo: 'exito', mensaje: 'Adjunto eliminado.' })
      return t
    } catch (error) {
      ui().notificarError(error)
      return null
    }
  }
}))
