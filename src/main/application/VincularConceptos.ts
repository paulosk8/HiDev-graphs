import type { Servicios } from '../servicios'
import type { Concepto } from '../domain/Concepto'
import { relacionarCon } from '../domain/Concepto'
import { crearRelacion } from '../domain/Relacion'
import { ErrorDeDominio } from '../domain/errores'
import type { TipoRelacion } from '../domain/tipos'

/**
 * Crea una relación tipada entre dos conceptos (capa de conocimiento). La
 * relación se guarda en el concepto de origen. Reutilizable desde el MCP para
 * aplicar las conexiones que sugiere la IA (análisis tipo Graphify).
 */
export function vincularConceptos(
  servicios: Servicios,
  origenId: string,
  destinoId: string,
  tipo: TipoRelacion
): Concepto {
  const { vault } = servicios
  if (origenId === destinoId) {
    throw new ErrorDeDominio('Un concepto no puede relacionarse consigo mismo.')
  }
  const origen = vault.leerConcepto(origenId)
  const actualizado = relacionarCon(origen, crearRelacion({ destino: destinoId, tipo }))
  vault.guardarConcepto(actualizado)
  return actualizado
}
