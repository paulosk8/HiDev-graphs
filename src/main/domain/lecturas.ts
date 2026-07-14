/**
 * Modelos de lectura: proyecciones ligeras del índice para alimentar la
 * interfaz sin cargar entidades completas. Son de solo lectura.
 */

/** Resumen de un concepto para listados y buscadores. */
export interface ResumenConcepto {
  readonly id: string
  readonly nombre: string
  readonly descripcion: string
  readonly totalRecursos: number
  /** Títulos de los temas que usan el concepto (para búsqueda). */
  readonly temas: string[]
  /** Dominio percibido 0..5 (0 si nunca se repasó). */
  readonly dominio: number
  /** Fecha ISO del próximo repaso, o null si nunca se ha repasado. */
  readonly proximaRevision: string | null
}

/** Resumen de una asignatura para el listado lateral. */
export interface ResumenAsignatura {
  readonly id: string
  readonly nombre: string
  readonly periodos: string[]
  readonly totalUnidades: number
  readonly totalTemas: number
}

/**
 * Un lugar donde se usa un concepto: responde a "¿en qué asignaturas / unidades
 * / temas se instancia este concepto?" para la ficha del concepto.
 *
 * Ej.: "Algoritmos 2026A › Unidad 1 › Tema 1".
 */
export interface UsoDeConcepto {
  readonly asignaturaId: string
  readonly asignatura: string
  readonly periodos: string[]
  readonly unidad: string
  readonly temaId: string
  readonly tema: string
}
