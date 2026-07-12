import type { DatosConceptoDTO } from '@shared/dtos'
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
  listarAsignaturas: () => desenvolver(window.api.listarAsignaturas()),
  reindexar: () => desenvolver(window.api.reindexar())
}
