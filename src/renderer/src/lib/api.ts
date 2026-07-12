import type { DatosAsignaturaDTO, DatosConceptoDTO } from '@shared/dtos'
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
  listarAsignaturas: () => desenvolver(window.api.listarAsignaturas()),
  obtenerAsignatura: (id: string) => desenvolver(window.api.obtenerAsignatura(id)),
  crearAsignatura: (datos: DatosAsignaturaDTO) => desenvolver(window.api.crearAsignatura(datos)),
  eliminarAsignatura: (id: string) => desenvolver(window.api.eliminarAsignatura(id)),
  reindexar: () => desenvolver(window.api.reindexar())
}
