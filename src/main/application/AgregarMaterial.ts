import { randomUUID } from 'node:crypto'
import { basename, extname } from 'node:path'

import type { ResultadoMaterialDTO } from '../../shared/dtos'
import { agregarRecurso, type Concepto } from '../domain/Concepto'
import { crearRecurso } from '../domain/Recurso'
import { ErrorDeDominio } from '../domain/errores'
import { formatoDesdeNombreArchivo } from '../domain/tipos'
import type { Servicios } from '../servicios'
import { aConceptoDTO } from './mapeadores'

/**
 * Agrega material a un concepto a partir de rutas de archivo (soltadas o
 * elegidas por el docente). Copia cada archivo al vault y lo clasifica por
 * extensión. Los formatos no soportados se ignoran y se informan (nunca
 * falla en silencio).
 */
export function agregarMaterial(
  servicios: Servicios,
  conceptoId: string,
  rutas: string[]
): ResultadoMaterialDTO {
  const { vault, repositorio } = servicios

  if (!vault.existeConcepto(conceptoId)) {
    throw new ErrorDeDominio('No encontramos ese concepto.', 'Puede que ya se haya eliminado.')
  }

  let concepto: Concepto = vault.leerConcepto(conceptoId)
  const ignorados: string[] = []
  let agregados = 0

  for (const ruta of rutas) {
    if (formatoDesdeNombreArchivo(ruta) === null) {
      ignorados.push(basename(ruta))
      continue
    }
    const { archivo, formato } = vault.copiarRecurso(conceptoId, ruta)
    const nombre = basename(ruta, extname(ruta)) || archivo
    concepto = agregarRecurso(concepto, crearRecurso({ id: randomUUID(), nombre, archivo, formato }))
    agregados += 1
  }

  if (agregados > 0) {
    vault.guardarConcepto(concepto)
    repositorio.indexarConcepto(concepto)
  }

  return { concepto: aConceptoDTO(concepto), agregados, ignorados }
}
