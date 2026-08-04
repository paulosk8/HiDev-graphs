/**
 * Nombres de los canales IPC. Única fuente de verdad para main, preload y
 * renderer: cambiar un canal aquí obliga a actualizar handler y API.
 */
export const CANALES = {
  // Conceptos
  conceptosListar: 'conceptos:listar',
  conceptosBuscar: 'conceptos:buscar',
  conceptosEtiquetas: 'conceptos:etiquetas',
  conceptoMenciones: 'concepto:menciones',
  lienzosListar: 'lienzos:listar',
  lienzosDeConcepto: 'lienzos:de-concepto',
  lienzoObtener: 'lienzo:obtener',
  lienzoCrear: 'lienzo:crear',
  lienzoGuardar: 'lienzo:guardar',
  lienzoEliminar: 'lienzo:eliminar',
  temaMover: 'tema:mover',
  notaMover: 'nota:mover',
  conceptoUsos: 'concepto:usos',
  conceptoObtenerFicha: 'concepto:ficha',
  conceptoCrear: 'concepto:crear',
  conceptoEditar: 'concepto:editar',
  conceptoEliminar: 'concepto:eliminar',
  conceptoRepasar: 'concepto:repasar',

  // Material
  materialAgregar: 'material:agregar',
  materialEliminar: 'material:eliminar',
  materialCarpetasListar: 'material:carpetas-listar',
  materialCarpetaCrear: 'material:carpeta-crear',
  materialMoverACarpeta: 'material:mover-a-carpeta',
  materialAbrir: 'material:abrir',
  materialLeerTexto: 'material:leer-texto',

  // Asignaturas
  asignaturasListar: 'asignaturas:listar',
  asignaturaObtener: 'asignatura:obtener',
  planificacionGuardar: 'planificacion:guardar',
  materialDeConceptos: 'material:de-conceptos',
  asignaturaCrear: 'asignatura:crear',
  asignaturaEditar: 'asignatura:editar',
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
  tareaCombinar: 'tarea:combinar',

  // Grafo
  grafoObtener: 'grafo:obtener',

  conceptoVincular: 'concepto:vincular',

  // Asistente IA (MCP)
  mcpInfo: 'mcp:info',
  mcpConectar: 'mcp:conectar',

  // Sistema
  reindexar: 'sistema:reindexar',
  respaldar: 'sistema:respaldar',
  restaurar: 'sistema:restaurar',

  // Almacenamiento del material (local / carpeta de nube tipo Google Drive)
  almacenamientoEstado: 'almacenamiento:estado',
  almacenamientoCarpetasNube: 'almacenamiento:carpetas-nube',
  almacenamientoElegirCarpeta: 'almacenamiento:elegir-carpeta',
  almacenamientoUsarNube: 'almacenamiento:usar-nube',
  almacenamientoUsarLocal: 'almacenamiento:usar-local',

  // Qué pasa al eliminar (mover a "Eliminados" o borrar definitivamente).
  eliminacionEstado: 'eliminacion:estado',
  eliminacionFijarModo: 'eliminacion:fijar-modo',
  eliminacionAbrirCarpeta: 'eliminacion:abrir-carpeta',
  eliminacionVaciar: 'eliminacion:vaciar',

  // Historial de versiones del material
  historialListar: 'historial:listar',
  historialVersiones: 'historial:versiones',
  historialRestaurar: 'historial:restaurar',

  // Terminal embebida
  terminalCrear: 'terminal:crear',
  terminalEscribir: 'terminal:escribir',
  terminalRedimensionar: 'terminal:redimensionar',
  terminalCerrar: 'terminal:cerrar',

  // Eventos push (main -> renderer)
  vaultCambiado: 'vault:cambiado',
  menuAccion: 'menu:accion',
  terminalDatos: 'terminal:datos',
  terminalSalida: 'terminal:salida'
} as const

export type Canal = (typeof CANALES)[keyof typeof CANALES]
