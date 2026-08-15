import { create } from 'zustand'
import type { CalidadRepaso, ConceptoDTO, DatosConceptoDTO, ResumenConceptoDTO } from '@shared/dtos'
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
  agregarMaterial: (
    conceptoId: string,
    rutas: string[],
    /** Carpeta destino dentro del concepto; vacío = suelto en la raíz. */
    carpeta?: string
  ) => Promise<ConceptoDTO | null>
  eliminarMaterial: (conceptoId: string, recursoId: string) => Promise<ConceptoDTO | null>
  /**
   * Refleja en el listado el material de un concepto recién modificado.
   *
   * Los enlaces web se agregan y quitan por `api` desde la zona de material, sin
   * pasar por este store; sin esto, el contador del listado (y el del chip de la
   * asignatura) se quedaría con el número anterior hasta recargar.
   */
  reflejarMaterial: (concepto: ConceptoDTO) => void
  /** Registra un repaso y refleja el nuevo dominio/próxima revisión en el listado. */
  repasar: (conceptoId: string, calidad: CalidadRepaso) => Promise<ConceptoDTO | null>
}

/** Actualiza el conteo de material (archivos + enlaces) de un concepto. */
function conConteoActualizado(
  lista: ResumenConceptoDTO[],
  concepto: ConceptoDTO
): ResumenConceptoDTO[] {
  return lista.map((c) =>
    c.id === concepto.id
      ? { ...c, totalRecursos: concepto.recursos.length, totalEnlaces: concepto.enlaces.length }
      : c
  )
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

  agregarMaterial: async (conceptoId, rutas, carpeta) => {
    try {
      const { concepto, agregados, ignorados } = await api.agregarMaterial(conceptoId, rutas, carpeta)
      set((estado) => ({
        lista: conConteoActualizado(estado.lista, concepto)
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
        lista: conConteoActualizado(estado.lista, concepto)
      }))
      ui().notificar({ tipo: 'exito', mensaje: 'Material eliminado.' })
      return concepto
    } catch (error) {
      ui().notificarError(error)
      return null
    }
  },

  reflejarMaterial: (concepto) =>
    set((estado) => ({ lista: conConteoActualizado(estado.lista, concepto) })),

  repasar: async (conceptoId, calidad) => {
    try {
      const concepto = await api.registrarRepaso(conceptoId, calidad)
      // Refleja el nuevo dominio y próxima revisión en el listado (mapa, estudio…).
      set((estado) => ({
        lista: estado.lista.map((c) =>
          c.id === conceptoId
            ? { ...c, dominio: concepto.dominio, proximaRevision: concepto.proximaRevision }
            : c
        )
      }))
      return concepto
    } catch (error) {
      ui().notificarError(error)
      return null
    }
  }
}))
