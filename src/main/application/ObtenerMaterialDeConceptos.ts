import type { MaterialConceptoDTO } from '../../shared/dtos'
import type { Servicios } from '../servicios'

/**
 * Devuelve el material (recursos) de un conjunto de conceptos, para preparar la
 * clase de una semana. Omite los conceptos sin material o inexistentes.
 */
export function obtenerMaterialDeConceptos(
  servicios: Servicios,
  conceptoIds: string[]
): MaterialConceptoDTO[] {
  const { vault } = servicios
  const salida: MaterialConceptoDTO[] = []
  for (const id of [...new Set(conceptoIds)]) {
    if (!vault.existeConcepto(id)) continue
    const concepto = vault.leerConcepto(id)
    if (concepto.recursos.length === 0) continue
    salida.push({
      conceptoId: concepto.id,
      nombre: concepto.nombre,
      recursos: concepto.recursos.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        archivo: r.archivo,
        formato: r.formato
      }))
    })
  }
  return salida
}
