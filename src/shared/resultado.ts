/**
 * Envoltura de resultado para el transporte IPC.
 *
 * Todo canal devuelve un `Resultado<T>` en vez de lanzar excepciones a través
 * del puente: así los errores viajan SIN PERDERSE (mensaje + sugerencia en
 * lenguaje humano) y el renderer decide cómo mostrarlos. Nada falla en silencio.
 */
export type Resultado<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly error: ErrorAmigable }

/** Error listo para mostrarse al docente: mensaje humano + acción sugerida. */
export interface ErrorAmigable {
  readonly mensaje: string
  readonly sugerencia?: string
}
