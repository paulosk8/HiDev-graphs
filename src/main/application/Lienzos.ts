import type { LienzoDTO, ResumenLienzoDTO } from '../../shared/dtos'
import { crearLienzo, lienzoDesdePlano, type Lienzo } from '../domain/Lienzo'
import { ErrorDeDominio } from '../domain/errores'
import { slugUnico } from '../domain/slug'
import type { Servicios } from '../servicios'

/**
 * Casos de uso de los lienzos. El lienzo es una VISTA: no contiene material ni
 * notas, solo referencias a lo que ya existe y dónde colocarlo. Por eso no se
 * indexa en SQLite —no aporta nada al grafo de conocimiento— y se consulta
 * escaneando su carpeta, como las tareas.
 */

function aResumen(l: Lienzo): ResumenLienzoDTO {
  return {
    id: l.id,
    nombre: l.nombre,
    totalTarjetas: l.nodes.filter((n) => n.type !== 'group').length,
    totalConexiones: l.edges.length
  }
}

export function listarLienzos(servicios: Servicios): ResumenLienzoDTO[] {
  return servicios.vault
    .leerTodosLienzos()
    .map(aResumen)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export function obtenerLienzo(servicios: Servicios, id: string): LienzoDTO {
  if (!servicios.vault.existeLienzo(id)) {
    throw new ErrorDeDominio('No encontramos ese lienzo.', 'Puede que ya se haya eliminado.')
  }
  const l = servicios.vault.leerLienzo(id)
  return { id: l.id, nombre: l.nombre, nodes: [...l.nodes], edges: [...l.edges] }
}

export function crearLienzoNuevo(servicios: Servicios, nombre: string): ResumenLienzoDTO {
  const existentes = new Set(servicios.vault.listarIdsLienzos())
  const id = slugUnico(nombre, existentes, 'lienzo')
  const lienzo = crearLienzo({ id, nombre })
  servicios.vault.guardarLienzo(lienzo)
  return aResumen(lienzo)
}

/**
 * Guarda el lienzo completo. Se manda entero y no por operaciones porque el
 * docente mueve y conecta muchas cosas seguidas: enviar cada micro-cambio
 * multiplicaría la escritura en una carpeta que además sincroniza la nube.
 */
export function guardarLienzo(servicios: Servicios, dto: LienzoDTO): LienzoDTO {
  if (!servicios.vault.existeLienzo(dto.id)) {
    throw new ErrorDeDominio('No encontramos ese lienzo.', 'Puede que ya se haya eliminado.')
  }
  // Se vuelve a pasar por el analizador para no escribir nada que no cuadre
  // (una conexión a una tarjeta borrada, medidas absurdas…).
  const saneado = lienzoDesdePlano(dto.id, dto.nombre, dto)
  servicios.vault.guardarLienzo(saneado)
  return { id: saneado.id, nombre: saneado.nombre, nodes: [...saneado.nodes], edges: [...saneado.edges] }
}

export function eliminarLienzo(servicios: Servicios, id: string): void {
  if (!servicios.vault.existeLienzo(id)) return
  servicios.vault.eliminarLienzo(id)
}
