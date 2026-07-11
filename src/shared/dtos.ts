/**
 * DTOs: formas de datos que cruzan el puente IPC entre main y renderer.
 *
 * Son independientes del dominio (el renderer NO importa el dominio). El main
 * mapea sus entidades/lecturas a estos DTOs. Aquí también viven los catálogos
 * de textos en español para la interfaz.
 */

export type TipoRelacion = 'prerequisito_de' | 'relacionado_con' | 'profundiza'

export type FormatoRecurso = 'pptx' | 'pdf' | 'md' | 'html' | 'docx' | 'xml'

// --- Lecturas (proyecciones para listados y fichas) ---

export interface ResumenConceptoDTO {
  id: string
  nombre: string
  totalRecursos: number
}

export interface ResumenAsignaturaDTO {
  id: string
  nombre: string
  periodo: string
  totalUnidades: number
  totalTemas: number
}

/** Un lugar donde se usa un concepto: "Algoritmos 2026A › Unidad 1 › Tema 1". */
export interface UsoDeConceptoDTO {
  asignaturaId: string
  asignatura: string
  periodo: string
  unidad: string
  temaId: string
  tema: string
}

export interface ResultadoReindexadoDTO {
  conceptos: number
  asignaturas: number
}

// --- Catálogos de textos para la UI (siempre en español) ---

/** Etiquetas legibles de las relaciones entre conceptos. */
export const ETIQUETAS_RELACION: Record<TipoRelacion, string> = {
  prerequisito_de: 'Prerrequisito de',
  relacionado_con: 'Relacionado con',
  profundiza: 'Profundiza en'
}

/** Componentes de aprendizaje sugeridos al crear una asignatura (editables). */
export const COMPONENTES_SUGERIDOS: ReadonlyArray<{ clave: string; nombre: string }> = [
  { clave: 'CD', nombre: 'Contacto docente' },
  { clave: 'CP', nombre: 'Componente práctico' },
  { clave: 'APE', nombre: 'Aprendizaje práctico experimental' },
  { clave: 'AA', nombre: 'Aprendizaje autónomo' }
]
