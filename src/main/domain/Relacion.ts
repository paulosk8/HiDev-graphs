import { exigir } from './errores'
import type { TipoRelacion } from './tipos'

/**
 * Relación tipada entre dos conceptos (capa de conocimiento).
 *
 * Se guarda en el concepto de origen; `destino` es el id del concepto al que
 * apunta. Ej.: "Recursividad" --prerequisito_de--> "Divide y vencerás".
 */
export interface Relacion {
  /** Id (slug) del concepto destino. */
  readonly destino: string
  readonly tipo: TipoRelacion
}

export function crearRelacion(datos: { destino: string; tipo: TipoRelacion }): Relacion {
  const destino = datos.destino.trim()
  exigir(destino.length > 0, 'La relación necesita un concepto de destino.')
  return { destino, tipo: datos.tipo }
}
