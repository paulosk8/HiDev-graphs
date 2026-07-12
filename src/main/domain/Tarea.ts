import { exigir, ErrorDeDominio } from './errores'
import type { Recurso } from './Recurso'
import type { FormatoInstrucciones } from './tipos'

/**
 * Tarea: actividad (evaluable o no) que el docente redacta para uno o varios
 * temas de una asignatura, opcionalmente asociada a un componente de aprendizaje.
 *
 * Es una capa transversal reutilizable (vive en `vault/tareas/`): se apoya en los
 * conceptos que instancian sus temas, lo que permite verla "por concepto" y
 * reutilizarla entre asignaturas/periodos (clonándola).
 *
 * Cardinalidades (según el uso real):
 *  - `temas`: uno o varios (tarea integradora), de UNA misma asignatura.
 *  - `componente`: 0 ó 1 (opcional; si es null, es una tarea "general" del tema).
 *  - `conceptos`: los conceptos en que se basa (se derivan de sus temas).
 */
export interface Tarea {
  readonly id: string
  readonly titulo: string
  /** Instrucciones (incluyen normalmente la rúbrica). El formato lo marca `formato`. */
  readonly instrucciones: string
  /** Formato de las instrucciones: 'markdown' (por defecto) o 'html'. */
  readonly formato: FormatoInstrucciones
  /** Asignatura "hogar" a la que pertenecen sus temas. */
  readonly asignaturaId: string
  readonly temas: readonly string[]
  /** Clave del componente de aprendizaje, o null si es general. */
  readonly componente: string | null
  readonly conceptos: readonly string[]
  /** Archivos adjuntos propios de la tarea (para desarrollarla). */
  readonly recursos: readonly Recurso[]
}

export interface DatosTarea {
  id: string
  titulo: string
  instrucciones?: string
  formato?: FormatoInstrucciones
  asignaturaId: string
  temas?: readonly string[]
  componente?: string | null
  conceptos?: readonly string[]
  recursos?: readonly Recurso[]
}

export function crearTarea(datos: DatosTarea): Tarea {
  const titulo = datos.titulo.trim()
  exigir(datos.id.trim().length > 0, 'La tarea no tiene identificador.')
  exigir(
    titulo.length > 0,
    'La tarea necesita un título.',
    'Escribe un título, por ejemplo "Taller de recursión".'
  )
  exigir(datos.asignaturaId.trim().length > 0, 'La tarea debe pertenecer a una asignatura.')
  exigir(
    (datos.temas ?? []).length > 0,
    'La tarea debe pertenecer al menos a un tema.',
    'Elige el tema (o temas) al que corresponde.'
  )

  const componente = datos.componente?.trim()
  return {
    id: datos.id.trim(),
    titulo,
    instrucciones: datos.instrucciones ?? '',
    formato: datos.formato ?? 'markdown',
    asignaturaId: datos.asignaturaId.trim(),
    temas: datos.temas ?? [],
    componente: componente ? componente : null,
    conceptos: datos.conceptos ?? [],
    recursos: datos.recursos ?? []
  }
}

export function agregarAdjunto(tarea: Tarea, recurso: Recurso): Tarea {
  if (tarea.recursos.some((r) => r.id === recurso.id)) {
    throw new ErrorDeDominio('Este adjunto ya está en la tarea.')
  }
  return { ...tarea, recursos: [...tarea.recursos, recurso] }
}

export function quitarAdjunto(tarea: Tarea, recursoId: string): Tarea {
  return { ...tarea, recursos: tarea.recursos.filter((r) => r.id !== recursoId) }
}
