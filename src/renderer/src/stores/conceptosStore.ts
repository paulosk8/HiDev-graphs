import { create } from 'zustand'
import type { DatosConceptoDTO, ResumenConceptoDTO } from '@shared/dtos'
import { api } from '../lib/api'
import { useUiStore } from './uiStore'

const ui = () => useUiStore.getState()

function ordenarPorNombre(lista: ResumenConceptoDTO[]): ResumenConceptoDTO[] {
  return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
}

interface ConceptosState {
  lista: ResumenConceptoDTO[]
  cargando: boolean

  cargar: () => Promise<void>
  crear: (datos: DatosConceptoDTO) => Promise<ResumenConceptoDTO | null>
  editar: (id: string, datos: DatosConceptoDTO) => Promise<ResumenConceptoDTO | null>
  eliminar: (id: string, nombre: string) => Promise<boolean>
}

export const useConceptosStore = create<ConceptosState>((set) => ({
  lista: [],
  cargando: false,

  cargar: async () => {
    set({ cargando: true })
    try {
      set({ lista: ordenarPorNombre(await api.listarConceptos()), cargando: false })
    } catch (error) {
      set({ cargando: false })
      ui().notificarError(error)
    }
  },

  crear: async (datos) => {
    try {
      const creado = await api.crearConcepto(datos)
      set((estado) => ({ lista: ordenarPorNombre([...estado.lista, creado]) }))
      ui().notificar({ tipo: 'exito', mensaje: `Concepto «${creado.nombre}» creado.` })
      return creado
    } catch (error) {
      ui().notificarError(error)
      return null
    }
  },

  editar: async (id, datos) => {
    try {
      const actualizado = await api.editarConcepto(id, datos)
      set((estado) => ({
        lista: ordenarPorNombre(estado.lista.map((c) => (c.id === id ? actualizado : c)))
      }))
      ui().notificar({ tipo: 'exito', mensaje: 'Cambios guardados.' })
      return actualizado
    } catch (error) {
      ui().notificarError(error)
      return null
    }
  },

  eliminar: async (id, nombre) => {
    try {
      await api.eliminarConcepto(id)
      set((estado) => ({ lista: estado.lista.filter((c) => c.id !== id) }))
      ui().notificar({ tipo: 'exito', mensaje: `Concepto «${nombre}» eliminado.` })
      return true
    } catch (error) {
      ui().notificarError(error)
      return false
    }
  }
}))
