import type {
  DatosAsignaturaDTO,
  DatosConceptoDTO,
  DatosTareaDTO,
  DuplicarTareaDTO
} from '@shared/dtos'
import type { ErrorAmigable, Resultado } from '@shared/resultado'

/**
 * Error amigable en el renderer, reconstruido desde el `Resultado` del main.
 * Conserva el mensaje humano y la acción sugerida para mostrarlos en la UI.
 */
export class ErrorAmigableError extends Error {
  readonly sugerencia?: string
  constructor(error: ErrorAmigable) {
    super(error.mensaje)
    this.name = 'ErrorAmigableError'
    this.sugerencia = error.sugerencia
  }
}

/** Desempaqueta un Resultado: devuelve el valor o lanza un error amigable. */
async function desenvolver<T>(promesa: Promise<Resultado<T>>): Promise<T> {
  const resultado = await promesa
  if (resultado.ok) return resultado.valor
  throw new ErrorAmigableError(resultado.error)
}

/**
 * API tipada para la interfaz. Envuelve `window.api` y desempaqueta los
 * resultados, de modo que los componentes trabajan con valores o try/catch.
 */
export const api = {
  listarConceptos: () => desenvolver(window.api.listarConceptos()),
  buscarConceptos: (texto: string) => desenvolver(window.api.buscarConceptos(texto)),
  usosDeConcepto: (conceptoId: string) => desenvolver(window.api.usosDeConcepto(conceptoId)),
  obtenerFichaConcepto: (conceptoId: string) =>
    desenvolver(window.api.obtenerFichaConcepto(conceptoId)),
  crearConcepto: (datos: DatosConceptoDTO) => desenvolver(window.api.crearConcepto(datos)),
  editarConcepto: (id: string, datos: DatosConceptoDTO) =>
    desenvolver(window.api.editarConcepto(id, datos)),
  eliminarConcepto: (id: string) => desenvolver(window.api.eliminarConcepto(id)),
  rutaDeArchivo: (archivo: File): string => window.api.rutaDeArchivo(archivo),
  agregarMaterial: (conceptoId: string, rutas: string[]) =>
    desenvolver(window.api.agregarMaterial(conceptoId, rutas)),
  eliminarMaterial: (conceptoId: string, recursoId: string) =>
    desenvolver(window.api.eliminarMaterial(conceptoId, recursoId)),
  abrirMaterial: (conceptoId: string, archivo: string) =>
    desenvolver(window.api.abrirMaterial(conceptoId, archivo)),
  leerTextoMaterial: (conceptoId: string, archivo: string) =>
    desenvolver(window.api.leerTextoMaterial(conceptoId, archivo)),
  /** URL del protocolo local para previsualizar un material (PDF/HTML/imagen). */
  urlRecurso: (conceptoId: string, archivo: string): string =>
    `recurso://c/${encodeURIComponent(conceptoId)}/${encodeURIComponent(archivo)}`,
  listarAsignaturas: () => desenvolver(window.api.listarAsignaturas()),
  obtenerAsignatura: (id: string) => desenvolver(window.api.obtenerAsignatura(id)),
  crearAsignatura: (datos: DatosAsignaturaDTO) => desenvolver(window.api.crearAsignatura(datos)),
  eliminarAsignatura: (id: string) => desenvolver(window.api.eliminarAsignatura(id)),
  agregarPeriodoAsignatura: (id: string, periodo: string) =>
    desenvolver(window.api.agregarPeriodoAsignatura(id, periodo)),
  quitarPeriodoAsignatura: (id: string, periodo: string) =>
    desenvolver(window.api.quitarPeriodoAsignatura(id, periodo)),
  vincularTemaConcepto: (asignaturaId: string, temaId: string, conceptoId: string) =>
    desenvolver(window.api.vincularTemaConcepto(asignaturaId, temaId, conceptoId)),
  desvincularTemaConcepto: (asignaturaId: string, temaId: string, conceptoId: string) =>
    desenvolver(window.api.desvincularTemaConcepto(asignaturaId, temaId, conceptoId)),
  listarTareasDeAsignatura: (asignaturaId: string) =>
    desenvolver(window.api.listarTareasDeAsignatura(asignaturaId)),
  listarTareasDeConcepto: (conceptoId: string) =>
    desenvolver(window.api.listarTareasDeConcepto(conceptoId)),
  obtenerTarea: (id: string) => desenvolver(window.api.obtenerTarea(id)),
  crearTarea: (datos: DatosTareaDTO) => desenvolver(window.api.crearTarea(datos)),
  editarTarea: (id: string, datos: DatosTareaDTO) => desenvolver(window.api.editarTarea(id, datos)),
  eliminarTarea: (id: string) => desenvolver(window.api.eliminarTarea(id)),
  agregarAdjuntoTarea: (tareaId: string, rutas: string[]) =>
    desenvolver(window.api.agregarAdjuntoTarea(tareaId, rutas)),
  eliminarAdjuntoTarea: (tareaId: string, recursoId: string) =>
    desenvolver(window.api.eliminarAdjuntoTarea(tareaId, recursoId)),
  abrirAdjuntoTarea: (tareaId: string, archivo: string) =>
    desenvolver(window.api.abrirAdjuntoTarea(tareaId, archivo)),
  crucesDeTarea: (tareaId: string) => desenvolver(window.api.crucesDeTarea(tareaId)),
  duplicarTarea: (tareaId: string, destino: DuplicarTareaDTO) =>
    desenvolver(window.api.duplicarTarea(tareaId, destino)),
  obtenerGrafo: () => desenvolver(window.api.obtenerGrafo()),
  obtenerInfoMcp: () => desenvolver(window.api.obtenerInfoMcp()),
  reindexar: () => desenvolver(window.api.reindexar()),
  respaldar: () => desenvolver(window.api.respaldar()),
  onVaultCambiado: (callback: () => void): (() => void) => window.api.onVaultCambiado(callback)
}
