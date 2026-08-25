import { randomUUID } from 'node:crypto'
import { statSync } from 'node:fs'
import { basename, extname } from 'node:path'

import type { ResultadoMaterialDTO } from '../../shared/dtos'
import { agregarRecurso, type Concepto } from '../domain/Concepto'
import { crearRecurso } from '../domain/Recurso'
import { ErrorDeDominio } from '../domain/errores'
import type { Servicios } from '../servicios'
import { aConceptoDTO } from './mapeadores'

/**
 * Agrega material a un concepto a partir de rutas de archivo (soltadas o
 * elegidas por el docente). Copia cada archivo al vault y lo clasifica por
 * extensión. Vale CUALQUIER formato: lo único que se ignora es lo que no es un
 * archivo (una carpeta) o lo que no se puede leer, y se informa de ello (nunca
 * falla en silencio).
 */
  /**
   * Lo que ya no se puede agregar. Antes el filtro por extensión descartaba de
   * paso lo que no era un archivo suelto —una CARPETA arrastrada no tiene
   * extensión— y eso lo tapaba. Sin ese filtro hay que mirarlo de frente: sobre
   * un directorio, `copyFileSync` revienta con EISDIR.
   */
export function esArchivoCopiable(ruta: string): boolean {
  try {
    return statSync(ruta).isFile()
  } catch {
    return false
  }
}

export function agregarMaterial(
  servicios: Servicios,
  conceptoId: string,
  rutas: string[],
  /** Carpeta destino dentro del concepto; vacío = suelto en la raíz. */
  carpeta = ''
): ResultadoMaterialDTO {
  const { vault, repositorio } = servicios

  if (!vault.existeConcepto(conceptoId)) {
    throw new ErrorDeDominio('No encontramos ese concepto.', 'Puede que ya se haya eliminado.')
  }

  let concepto: Concepto = vault.leerConcepto(conceptoId)
  const ignorados: string[] = []
  let agregados = 0

  for (const ruta of rutas) {
    if (!esArchivoCopiable(ruta)) {
      ignorados.push(basename(ruta))
      continue
    }
    const { archivo, formato } = vault.copiarRecurso(conceptoId, ruta, carpeta)
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
