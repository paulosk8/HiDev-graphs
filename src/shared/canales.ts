/**
 * Nombres de los canales IPC. Única fuente de verdad para main, preload y
 * renderer: cambiar un canal aquí obliga a actualizar handler y API.
 */
export const CANALES = {
  // Conceptos
  conceptosListar: 'conceptos:listar',
  conceptosBuscar: 'conceptos:buscar',
  conceptoUsos: 'concepto:usos',
  conceptoObtenerFicha: 'concepto:ficha',
  conceptoCrear: 'concepto:crear',
  conceptoEditar: 'concepto:editar',
  conceptoEliminar: 'concepto:eliminar',

  // Material
  materialAgregar: 'material:agregar',
  materialEliminar: 'material:eliminar',

  // Asignaturas
  asignaturasListar: 'asignaturas:listar',
  asignaturaObtener: 'asignatura:obtener',
  asignaturaCrear: 'asignatura:crear',
  asignaturaEliminar: 'asignatura:eliminar',

  // Vínculos tema <-> concepto
  temaVincularConcepto: 'tema:vincular-concepto',
  temaDesvincularConcepto: 'tema:desvincular-concepto',

  // Sistema
  reindexar: 'sistema:reindexar'
} as const

export type Canal = (typeof CANALES)[keyof typeof CANALES]
