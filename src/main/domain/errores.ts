/**
 * Error de dominio: representa una regla de negocio incumplida.
 *
 * Su mensaje SIEMPRE está en lenguaje humano (español, sin jerga técnica)
 * porque puede llegar tal cual a la interfaz del docente. La `sugerencia`
 * opcional propone la acción para resolverlo.
 */
export class ErrorDeDominio extends Error {
  readonly sugerencia?: string

  constructor(mensaje: string, sugerencia?: string) {
    super(mensaje)
    this.name = 'ErrorDeDominio'
    this.sugerencia = sugerencia
  }
}

/** Lanza un ErrorDeDominio si la condición no se cumple. */
export function exigir(condicion: boolean, mensaje: string, sugerencia?: string): void {
  if (!condicion) {
    throw new ErrorDeDominio(mensaje, sugerencia)
  }
}
