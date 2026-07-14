import { create } from 'zustand'
import type {
  AsignaturaDTO,
  DatosAsignaturaDTO,
  DatosAsignaturaEdicionDTO,
  ResumenAsignaturaDTO
} from '@shared/dtos'
import { api } from '../lib/api'
import { useUiStore } from './uiStore'

const ui = () => useUiStore.getState()

function ordenar(lista: ResumenAsignaturaDTO[]): ResumenAsignaturaDTO[] {
  return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
}

interface AsignaturasState {
  lista: ResumenAsignaturaDTO[]
  cargando: boolean

  cargar: () => Promise<void>
  crear: (datos: DatosAsignaturaDTO) => Promise<ResumenAsignaturaDTO | null>
  editar: (id: string, datos: DatosAsignaturaEdicionDTO) => Promise<AsignaturaDTO | null>
  eliminar: (id: string, nombre: string) => Promise<boolean>
}

export const useAsignaturasStore = create<AsignaturasState>((set) => ({
  lista: [],
  cargando: false,

  cargar: async () => {
    set({ cargando: true })
    try {
      set({ lista: ordenar(await api.listarAsignaturas()), cargando: false })
    } catch (error) {
      set({ cargando: false })
      ui().notificarError(error)
    }
  },

  crear: async (datos) => {
    try {
      const creada = await api.crearAsignatura(datos)
      set((estado) => ({ lista: ordenar([...estado.lista, creada]) }))
      ui().notificar({ tipo: 'exito', mensaje: `Asignatura «${creada.nombre}» creada.` })
      return creada
    } catch (error) {
      ui().notificarError(error)
      return null
    }
  },

  editar: async (id, datos) => {
    try {
      const editada = await api.editarAsignatura(id, datos)
      set((estado) => ({
        lista: ordenar(
          estado.lista.map((a) =>
            a.id === id
              ? {
                  ...a,
                  nombre: editada.nombre,
                  periodos: editada.periodos,
                  totalUnidades: editada.unidades.length,
                  totalTemas: editada.unidades.reduce((n, u) => n + u.temas.length, 0)
                }
              : a
          )
        )
      }))
      ui().notificar({ tipo: 'exito', mensaje: `Cambios guardados en «${editada.nombre}».` })
      return editada
    } catch (error) {
      ui().notificarError(error)
      return null
    }
  },

  eliminar: async (id, nombre) => {
    try {
      await api.eliminarAsignatura(id)
      set((estado) => ({ lista: estado.lista.filter((a) => a.id !== id) }))
      ui().notificar({ tipo: 'exito', mensaje: `Asignatura «${nombre}» eliminada.` })
      return true
    } catch (error) {
      ui().notificarError(error)
      return false
    }
  }
}))
