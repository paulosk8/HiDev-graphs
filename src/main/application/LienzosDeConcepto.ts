import type { ResumenLienzoDTO } from '../../shared/dtos'
import { conceptoDeRuta, materialDeRuta } from '../domain/Lienzo'
import type { Servicios } from '../servicios'

/**
 * "Se usa en estos lienzos": en qué mapas aparece un concepto.
 *
 * Cuenta tanto la tarjeta del concepto como las de sus notas o su material:
 * si el docente llevó al lienzo un PDF de este concepto, ese lienzo también
 * habla de él, y esconderlo sería mentir por tecnicismo.
 *
 * Se resuelve escaneando los .canvas, no el índice SQLite: los lienzos son
 * una vista y no se indexan (no aportan nada al grafo de conocimiento). Son
 * pocos y el escaneo solo ocurre al abrir una ficha.
 */
export function lienzosDeConcepto(servicios: Servicios, conceptoId: string): ResumenLienzoDTO[] {
  return servicios.vault
    .leerTodosLienzos()
    .filter((l) =>
      l.nodes.some((n) => {
        if (conceptoDeRuta(n.file) === conceptoId) return true
        return materialDeRuta(n.file)?.conceptoId === conceptoId
      })
    )
    .map((l) => ({
      id: l.id,
      nombre: l.nombre,
      ...(l.contexto ? { contexto: l.contexto } : {}),
      totalTarjetas: l.nodes.filter((n) => n.type !== 'group').length,
      totalConexiones: l.edges.length
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}
