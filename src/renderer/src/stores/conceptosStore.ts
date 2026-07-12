import { create } from 'zustand'
import type { ConceptoDTO, DatosConceptoDTO, ResumenConceptoDTO } from '@shared/dtos'
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
  agregarMaterial: (conceptoId: string, rutas: string[]) => Promise<ConceptoDTO | null>
  eliminarMaterial: (conceptoId: string, recursoId: string) => Promise<ConceptoDTO | null>
}

/** Actualiza el conteo de material de un concepto en el listado. */
function conConteoActualizado(
  lista: ResumenConceptoDTO[],
  id: string,
  total: number
): ResumenConceptoDTO[] {
  return lista.map((c) => (c.id === id ? { ...c, totalRecursos: total } : c))
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
        // Conserva temas y asignaturas ya conocidos (el resumen de edición no los trae).
        lista: ordenarPorNombre(
          estado.lista.map((c) =>
            c.id === id ? { ...actualizado, temas: c.temas, asignaturas: c.asignaturas } : c
          )
        )
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
  },

  agregarMaterial: async (conceptoId, rutas) => {
    try {
      const { concepto, agregados, ignorados } = await api.agregarMaterial(conceptoId, rutas)
      set((estado) => ({
        lista: conConteoActualizado(estado.lista, conceptoId, concepto.recursos.length)
      }))
      if (agregados > 0) {
        ui().notificar({
          tipo: 'exito',
          mensaje: agregados === 1 ? 'Material agregado.' : `${agregados} materiales agregados.`
        })
      }
      if (ignorados.length > 0) {
        ui().notificar({
          tipo: 'error',
          mensaje: `No se pudo agregar: ${ignorados.join(', ')}.`,
          sugerencia: 'Formatos aceptados: PDF, PowerPoint, Word, Markdown, HTML y XML.'
        })
      }
      return concepto
    } catch (error) {
      ui().notificarError(error)
      return null
    }
  },

  eliminarMaterial: async (conceptoId, recursoId) => {
    try {
      const concepto = await api.eliminarMaterial(conceptoId, recursoId)
      set((estado) => ({
        lista: conConteoActualizado(estado.lista, conceptoId, concepto.recursos.length)
      }))
      ui().notificar({ tipo: 'exito', mensaje: 'Material eliminado.' })
      return concepto
    } catch (error) {
      ui().notificarError(error)
      return null
    }
  }
}))
