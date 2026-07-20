/**
 * DTOs: formas de datos que cruzan el puente IPC entre main y renderer.
 *
 * Son independientes del dominio (el renderer NO importa el dominio). El main
 * mapea sus entidades/lecturas a estos DTOs. Aquí también viven los catálogos
 * de textos en español para la interfaz.
 */

export type TipoRelacion = 'prerequisito_de' | 'relacionado_con' | 'profundiza'

/** Un espacio es de DOCENCIA (asignatura) o de APRENDIZAJE (workspace para aprender). */
export type TipoAsignatura = 'docencia' | 'aprendizaje'

export type FormatoRecurso =
  | 'pptx'
  | 'pdf'
  | 'md'
  | 'html'
  | 'docx'
  | 'xml'
  | 'txt'
  | 'css'
  | 'js'
  | 'json'
  | 'csv'

/** Formatos basados en texto que se pueden previsualizar como texto plano. */
export const FORMATOS_TEXTO: readonly FormatoRecurso[] = ['md', 'xml', 'txt', 'css', 'js', 'json', 'csv']

// --- Lecturas (proyecciones para listados y fichas) ---

export interface ResumenConceptoDTO {
  id: string
  nombre: string
  descripcion: string
  totalRecursos: number
  /** Títulos de los temas que usan el concepto (para búsqueda). */
  temas: string[]
  /** Nombres de las asignaturas donde se usa (para agrupar/filtrar). */
  asignaturas: string[]
  /** Dominio percibido 0..5 (0 si nunca se repasó). Colorea el mapa. */
  dominio: number
  /** Fecha ISO (YYYY-MM-DD) del próximo repaso, o null si nunca se repasó. */
  proximaRevision: string | null
}

/** Calidad del recuerdo al repasar: 0 = no me acuerdo, 3 = con esfuerzo, 4 = bien, 5 = fácil. */
export type CalidadRepaso = 0 | 1 | 2 | 3 | 4 | 5

export interface RecursoDTO {
  id: string
  nombre: string
  archivo: string
  formato: FormatoRecurso
}

/** Material (recursos) de un concepto, para preparar la clase por semana. */
export interface MaterialConceptoDTO {
  conceptoId: string
  nombre: string
  recursos: RecursoDTO[]
}

export interface RelacionDTO {
  destino: string
  tipo: TipoRelacion
}

/** Una nota u observación sobre un concepto (varias por concepto). */
export interface NotaDTO {
  id: string
  titulo: string
  contenido: string
  formato: FormatoInstrucciones
}

/** Detalle completo de un concepto para su ficha. */
export interface ConceptoDTO {
  id: string
  nombre: string
  descripcion: string
  recursos: RecursoDTO[]
  relaciones: RelacionDTO[]
  /** Notas u observaciones propias sobre el concepto (varias). */
  notas: NotaDTO[]
  /** Dominio percibido 0..5 (0 si nunca se repasó). */
  dominio: number
  /** Fecha ISO del próximo repaso, o null si nunca se repasó. */
  proximaRevision: string | null
}

/** Ficha de un concepto: su detalle + dónde se usa. */
export interface FichaConceptoDTO {
  concepto: ConceptoDTO
  usos: UsoDeConceptoDTO[]
}

/** Datos para crear o editar un concepto. */
export interface DatosConceptoDTO {
  nombre: string
  descripcion?: string
  /** Notas propias (varias). Si se omite al editar, se conservan las actuales. */
  notas?: NotaDTO[]
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
  tipo: TipoAsignatura
  periodos: string[]
  totalUnidades: number
  totalTemas: number
  totalTareas: number
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

/** Una semana de la planificación: número + temas que se tratan. */
export interface SemanaPlanDTO {
  numero: number
  temas: string[]
}

/** Planificación semanal de un período. */
export interface PlanificacionDTO {
  periodo: string
  semanas: SemanaPlanDTO[]
}

/** Detalle completo de una asignatura para su ficha. */
export interface AsignaturaDTO {
  id: string
  nombre: string
  tipo: TipoAsignatura
  periodos: string[]
  componentes: ComponenteDTO[]
  unidades: UnidadDTO[]
  /** Planificación semanal por período. */
  planificaciones: PlanificacionDTO[]
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
  /** Docencia por defecto; 'aprendizaje' para un workspace de estudio. */
  tipo?: TipoAsignatura
  periodos: string[]
  componentes: ComponenteDTO[]
  unidades: DatosUnidadDTO[]
}

// --- Payload para EDITAR una asignatura existente ---
//
// A diferencia de crearla, la edición conserva la identidad de las unidades y
// temas que ya existían: cada uno lleva su `id`. Los que llegan SIN `id` son
// nuevos. Los que ya no aparecen se eliminan (y la app limpia sus vínculos a
// conceptos, tareas y planificación). Los subtemas de un tema existente se
// conservan intactos (el asistente no los edita).

export interface DatosSubtemaEdicionDTO {
  /** Id del subtema existente; ausente si es nuevo. */
  id?: string
  titulo: string
}

export interface DatosTemaEdicionDTO {
  /** Id del tema existente; ausente si es un tema nuevo. */
  id?: string
  titulo: string
  /** Subtemas (3er nivel). Si se omite, se conservan los del tema existente. */
  subtemas?: DatosSubtemaEdicionDTO[]
}

export interface DatosUnidadEdicionDTO {
  /** Id de la unidad existente; ausente si es una unidad nueva. */
  id?: string
  titulo: string
  temas: DatosTemaEdicionDTO[]
}

export interface DatosAsignaturaEdicionDTO {
  nombre: string
  periodos: string[]
  componentes: ComponenteDTO[]
  /** Estructura (temas/subtemas). Si se omite, se conserva la actual (se edita inline). */
  unidades?: DatosUnidadEdicionDTO[]
}

// --- Tareas (capa transversal) ---

/** Formato del contenido: Markdown, HTML (con CSS/JS) o código (vista tipo editor). */
export type FormatoInstrucciones = 'markdown' | 'html' | 'codigo'

/** Enlace a un recurso online que el estudiante puede usar en la tarea. */
export interface EnlaceDTO {
  url: string
  titulo: string
}

export interface TareaDTO {
  id: string
  titulo: string
  /** Instrucciones (Markdown o HTML, según `formato`). */
  instrucciones: string
  formato: FormatoInstrucciones
  asignaturaId: string
  temas: string[]
  /** Clave del componente, o null si es una tarea general. */
  componente: string | null
  conceptos: string[]
  recursos: RecursoDTO[]
  /** Enlaces a recursos online (con su título visible). */
  enlaces: EnlaceDTO[]
}

export interface ResumenTareaDTO {
  id: string
  titulo: string
  asignaturaId: string
  temas: string[]
  componente: string | null
  totalAdjuntos: number
}

/** Datos para crear o editar una tarea. Los conceptos se derivan de sus temas. */
export interface DatosTareaDTO {
  titulo: string
  instrucciones: string
  formato: FormatoInstrucciones
  asignaturaId: string
  temas: string[]
  componente: string | null
  /** Enlaces a recursos online (opcional). */
  enlaces?: EnlaceDTO[]
}

/** Resultado de adjuntar archivos a una tarea. */
export interface ResultadoAdjuntoDTO {
  tarea: TareaDTO
  agregados: number
  ignorados: string[]
}

/**
 * Cruce: un tema de OTRA asignatura que comparte un concepto con la tarea.
 * Es la conexión por grafo que permite reutilizar el contenido entre periodos.
 */
export interface CruceDTO {
  conceptoId: string
  asignaturaId: string
  asignatura: string
  periodos: string[]
  unidad: string
  temaId: string
  tema: string
}

/** Datos para duplicar una tarea en otra asignatura (reutilización). */
export interface DuplicarTareaDTO {
  asignaturaId: string
  temas: string[]
  titulo: string
}

/**
 * Datos para combinar varias tareas en una nueva reutilizando su material.
 * La nueva tarea hereda la UNIÓN de los adjuntos de las tareas origen.
 */
export interface CombinarTareasDTO {
  /** Ids de las tareas origen (2 o más). */
  tareasOrigen: string[]
  asignaturaId: string
  temas: string[]
  titulo: string
  /** Instrucciones en Markdown; si se omite, se fusionan las de las tareas origen. */
  instrucciones?: string
  componente?: string | null
}

/** Un lugar donde se usa un concepto: "Algoritmos · 2026A, 2026B › Unidad 1 › Tema 1". */
export interface UsoDeConceptoDTO {
  asignaturaId: string
  asignatura: string
  periodos: string[]
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

/** Resultado de restaurar una copia de seguridad (o su cancelación). */
export interface RestauracionDTO {
  cancelado: boolean
  conceptos?: number
  asignaturas?: number
  tareas?: number
}

// --- Almacenamiento del material (dónde vive: este equipo o carpeta de nube) ---

/** Dónde guarda el docente su material. */
export type ModoAlmacenamiento = 'local' | 'nube'

/** Proveedor de nube detectado por su carpeta local sincronizada. */
export type ProveedorNube = 'google' | 'onedrive'

/** Una carpeta de nube detectada en el equipo, lista para guardar el material. */
export interface CarpetaNubeDTO {
  proveedor: ProveedorNube
  /** Nombre amigable para la UI ("Google Drive", "OneDrive · Trabajo"). */
  etiqueta: string
  /** Carpeta contenedora donde vivirá el material (uso interno). */
  ruta: string
}

/** Estado actual del almacenamiento del material, para mostrarlo en Configuración. */
export interface AlmacenamientoDTO {
  /** true si el usuario ya completó la bienvenida (eligió dónde guardar). */
  configurado: boolean
  modo: ModoAlmacenamiento
  /** Nombre amigable de dónde se guarda ("Este equipo", "Google Drive · …"). */
  nombreVisible: string
  /** Carpeta del material (uso informativo; no se muestra como acción). */
  ruta: string
}

/** Resultado de mover el material a otro sitio (antes de reiniciar la app). */
export interface ResultadoAlmacenamientoDTO {
  modo: ModoAlmacenamiento
  nombreVisible: string
  /** true si el destino ya tenía material y se adoptó (segundo equipo). */
  adoptado: boolean
  /** true si ya estaba en ese sitio (no hubo cambios). */
  sinCambios: boolean
}

// --- Historial de versiones del material ---

/** Tipo de elemento versionado. */
export type TablaHistorial = 'conceptos' | 'asignaturas' | 'tareas'

/** Un elemento con historial (ha cambiado al menos una vez). */
export interface ItemHistorialDTO {
  tabla: TablaHistorial
  id: string
  nombre: string
  /** Etiqueta del tipo para la UI: "Concepto" | "Asignatura" | "Tarea". */
  tipoEtiqueta: string
  /** Nº de versiones guardadas. */
  versiones: number
  /** Marca de tiempo (ms) de la última modificación. */
  ultimaModificacionMs: number
}

/** Una versión concreta de un elemento. */
export interface VersionHistorialDTO {
  /** Identificador de la versión (para restaurarla). */
  versionId: string
  /** Marca de tiempo (ms) en que se capturó. */
  capturadoEnMs: number
  /** Resumen legible del contenido de esa versión. */
  resumen: string
}

/** Datos para configurar el servidor MCP (asistente IA) en un CLI externo. */
export type ClienteMcpId = 'gemini' | 'claude'

/** Estado de un CLI de IA respecto al servidor MCP de PedagoGraph. */
export interface ClienteMcpDTO {
  id: ClienteMcpId
  nombre: string
  /** El CLI parece instalado/usado en este equipo. */
  instalado: boolean
  /** Ya tiene configurado el servidor «pedagograph». */
  conectado: boolean
  /** Archivo de configuración (informativo), cuando aplica. */
  rutaConfig?: string
}

export interface McpInfoDTO {
  rutaServidor: string
  rutaVault: string
  /**
   * Ruta del ejecutable de la app (Electron). Se usa como `command` con
   * ELECTRON_RUN_AS_NODE=1 para lanzar el servidor MCP con el motor incluido,
   * sin exigir que el usuario tenga Node instalado.
   */
  ejecutable: string
  /** true si el bundle del servidor ya está compilado (npm run build:mcp). */
  compilado: boolean
  /** Estado de auto-conexión por cada CLI de IA soportado. */
  clientes: ClienteMcpDTO[]
}

// --- Grafo (Fase 2) ---

export type TipoNodoGrafo = 'concepto' | 'asignatura' | 'tarea'
export type TipoAristaGrafo = 'usado_en' | 'coocurre' | 'tarea_concepto' | TipoRelacion

export interface NodoGrafoDTO {
  /** Id con prefijo ('c:' concepto, 'a:' asignatura, 't:' tarea) para unicidad. */
  id: string
  etiqueta: string
  tipo: TipoNodoGrafo
  /** Para conceptos: en cuántas asignaturas se usa (mide su transversalidad). */
  peso: number
  /** Para tareas: la asignatura a la que pertenece (para navegar a su ficha). */
  asignaturaId?: string
}

export interface AristaGrafoDTO {
  origen: string
  destino: string
  tipo: TipoAristaGrafo
  /** Id de la asignatura (solo aristas 'usado_en'), para filtrar por asignatura. */
  asignaturaId?: string
}

export interface GrafoDTO {
  nodos: NodoGrafoDTO[]
  aristas: AristaGrafoDTO[]
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
