/**
 * Punto de entrada de la capa de dominio.
 *
 * Reexporta entidades, tipos y contratos puros. Sin dependencias de Electron,
 * SQLite ni sistema de archivos.
 */
export * from './tipos'
export * from './errores'
export * from './slug'

export * from './Recurso'
export * from './Relacion'
export * from './Concepto'

export * from './Subtema'
export * from './Tema'
export * from './Unidad'
export * from './Asignatura'

export * from './lecturas'
export * from './IGraphRepository'
