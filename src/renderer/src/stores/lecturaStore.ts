import { create } from 'zustand'
import type { EstadoLecturaDTO } from '@shared/dtos'
import { api } from '../lib/api'
import { useAsignaturasStore } from './asignaturasStore'
import { useConceptosStore } from './conceptosStore'

/**
 * Material que no se pudo leer.
 *
 * Cuando el vault vive en OneDrive o Google Drive y el cliente de nube no ha
 * iniciado sesión, está pausado o no hay internet, los archivos no se pueden
 * abrir y sus conceptos y asignaturas desaparecen del listado. Antes eso
 * ocurría en silencio y parecía material perdido. Este store guarda qué falta
 * y por qué, para que la interfaz lo diga y ofrezca reintentar.
 */
interface LecturaState {
  estado: EstadoLecturaDTO | null
  reintentando: boolean
  /** El docente cerró el aviso; vuelve a aparecer si el problema cambia. */
  oculto: boolean

  cargar: () => Promise<void>
  /** Recibe el estado que empuja el proceso principal al cambiar la situación. */
  recibir: (estado: EstadoLecturaDTO) => void
  reintentar: () => Promise<void>
  ocultar: () => void
}

/**
 * ¿Se puede trabajar con el material ahora mismo?
 *
 * false cuando no hay carpeta que leer: la ubicación configurada ya no existe,
 * o no se pudo listar ni una sola carpeta del material. En ese estado no hay
 * proyecto abierto, así que las operaciones que actúan SOBRE el material
 * (copia de seguridad, historial, reindexar, eliminados) no tienen objeto —y
 * algunas harían daño: respaldar guardaría un archivo vacío y reindexar
 * borraría el índice de lo que no se ve.
 *
 * Mientras no se sabe (arranque), se asume que sí: es preferible a que las
 * opciones parpadeen al abrir la configuración.
 */
export function hayMaterialDisponible(estado: EstadoLecturaDTO | null): boolean {
  if (!estado) return true
  return estado.causa !== 'ubicacion' && !estado.carpetaCompleta
}

/** ¿Hay algo que avisar? Falta al menos un elemento, o una carpeta entera. */
export function hayMaterialSinLeer(estado: EstadoLecturaDTO | null): boolean {
  return estado !== null && (estado.total > 0 || estado.carpetaCompleta)
}

/** Huella del problema: si cambia, un aviso ocultado vuelve a mostrarse. */
function huella(estado: EstadoLecturaDTO): string {
  return `${estado.total}:${estado.causa}:${estado.carpetaCompleta}`
}

export const useLecturaStore = create<LecturaState>((set, get) => ({
  estado: null,
  reintentando: false,
  oculto: false,

  cargar: async () => {
    try {
      set({ estado: await api.estadoLectura() })
    } catch {
      // El aviso es informativo: si no se puede consultar, no se estorba.
    }
  },

  recibir: (estado) => {
    const anterior = get().estado
    const cambio = !anterior || huella(anterior) !== huella(estado)
    set({ estado, oculto: cambio ? false : get().oculto })
  },

  reintentar: async () => {
    set({ reintentando: true })
    try {
      const estado = await api.reintentarLectura()
      set({ estado, oculto: false })
      // Si la nube ya responde, esto trae de vuelta lo que faltaba.
      await Promise.all([
        useConceptosStore.getState().cargar(),
        useAsignaturasStore.getState().cargar()
      ])
    } catch {
      // Sigue fallando: el aviso se queda como estaba.
    } finally {
      set({ reintentando: false })
    }
  },

  ocultar: () => set({ oculto: true })
}))
