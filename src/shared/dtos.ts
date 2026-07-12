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

export interface RecursoDTO {
  id: string
  nombre: string
  archivo: string
  formato: FormatoRecurso
}

export interface RelacionDTO {
  destino: string
  tipo: TipoRelacion
}

/** Detalle completo de un concepto para su ficha. */
export interface ConceptoDTO {
  id: string
  nombre: string
  descripcion: string
  recursos: RecursoDTO[]
  relaciones: RelacionDTO[]
}

/** Ficha de un concepto: su detalle + dónde se usa. */
export interface FichaConceptoDTO {
  concepto: ConceptoDTO
  usos: UsoDeConceptoDTO[]
}

/** Datos para crear o editar un concepto (formulario de 2 campos). */
export interface DatosConceptoDTO {
  nombre: string
  descripcion?: string
}

/** Resultado de agregar material: concepto actualizado + qué se ignoró. */
export interface ResultadoMaterialDTO {
  concepto: ConceptoDTO
  agregados: number
  /** Nombres de archivo ignorados por tener un formato no soportado. */
  ignorados: string[]
}

export interface ResumenAsignaturaDTO {
  id: string
  nombre: string
  periodo: string
  totalUnidades: number
  totalTemas: number
}

export interface ComponenteDTO {
  clave: string
  nombre: string
}

export interface SubtemaDTO {
  id: string
  titulo: string
  orden: number
}

export interface TemaDTO {
  id: string
  titulo: string
  orden: number
  semana: number | null
  subtemas: SubtemaDTO[]
  /** Ids de conceptos vinculados (puente). Se rellenan en el bloque de vínculos. */
  conceptos: string[]
}

export interface UnidadDTO {
  id: string
  titulo: string
  orden: number
  temas: TemaDTO[]
}

/** Detalle completo de una asignatura para su ficha. */
export interface AsignaturaDTO {
  id: string
  nombre: string
  periodo: string
  componentes: ComponenteDTO[]
  unidades: UnidadDTO[]
}

// --- Payload del asistente para crear una asignatura ---

export interface DatosTemaDTO {
  titulo: string
  semana?: number | null
  subtemas?: string[]
}

export interface DatosUnidadDTO {
  titulo: string
  temas: DatosTemaDTO[]
}

export interface DatosAsignaturaDTO {
  nombre: string
  periodo: string
  componentes: ComponenteDTO[]
  unidades: DatosUnidadDTO[]
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

/** Resultado de una copia de seguridad (o su cancelación por el usuario). */
export interface RespaldoDTO {
  cancelado: boolean
  ruta?: string
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
