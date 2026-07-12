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
  materialAbrir: 'material:abrir',
  materialLeerTexto: 'material:leer-texto',

  // Asignaturas
  asignaturasListar: 'asignaturas:listar',
  asignaturaObtener: 'asignatura:obtener',
  asignaturaCrear: 'asignatura:crear',
  asignaturaEliminar: 'asignatura:eliminar',
  asignaturaAgregarPeriodo: 'asignatura:agregar-periodo',
  asignaturaQuitarPeriodo: 'asignatura:quitar-periodo',

  // Vínculos tema <-> concepto
  temaVincularConcepto: 'tema:vincular-concepto',
  temaDesvincularConcepto: 'tema:desvincular-concepto',

  // Tareas
  tareasDeAsignatura: 'tareas:de-asignatura',
  tareasDeConcepto: 'tareas:de-concepto',
  tareaObtener: 'tarea:obtener',
  tareaCrear: 'tarea:crear',
  tareaEditar: 'tarea:editar',
  tareaEliminar: 'tarea:eliminar',
  tareaAdjuntoAgregar: 'tarea:adjunto-agregar',
  tareaAdjuntoEliminar: 'tarea:adjunto-eliminar',
  tareaAdjuntoAbrir: 'tarea:adjunto-abrir',
  tareaCruces: 'tarea:cruces',
  tareaDuplicar: 'tarea:duplicar',

  // Grafo
  grafoObtener: 'grafo:obtener',

  // Sistema
  reindexar: 'sistema:reindexar',
  respaldar: 'sistema:respaldar',

  // Eventos push (main -> renderer)
  vaultCambiado: 'vault:cambiado'
} as const

export type Canal = (typeof CANALES)[keyof typeof CANALES]
