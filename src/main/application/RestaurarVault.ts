import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'

import type { Servicios } from '../servicios'
import { ErrorDeDominio } from '../domain/errores'
import { reindexarVault } from './ReindexarVault'

export interface ResultadoRestauracion {
  conceptos: number
  asignaturas: number
  tareas: number
}

/** Carpetas del vault que un respaldo puede restaurar (el resto se ignora). */
const CARPETAS_VALIDAS = ['conceptos/', 'asignaturas/', 'tareas/']

/**
 * Restaura un respaldo (.zip creado por `respaldarVault`) dentro del vault.
 *
 * Descomprime `conceptos/`, `asignaturas/` y `tareas/` sobre el vault actual
 * (los elementos con el mismo nombre se sobrescriben; los demás se conservan) y
 * reconstruye el índice. No toca `.index/` (es reconstruible). Portable entre
 * sistemas: el material se referencia por nombre de archivo relativo.
 *
 * Usa importación dinámica de jszip porque el main se empaqueta como CommonJS.
 */
export async function restaurarVault(
  servicios: Servicios,
  rutaZip: string
): Promise<ResultadoRestauracion> {
  const { vault, repositorio } = servicios
  const { default: JSZip } = await import('jszip')

  const zip = await JSZip.loadAsync(readFileSync(rutaZip))
  const raiz = resolve(vault.raiz)

  const entradas = Object.values(zip.files).filter(
    (e) => !e.dir && CARPETAS_VALIDAS.some((c) => e.name.startsWith(c))
  )
  if (entradas.length === 0) {
    throw new ErrorDeDominio(
      'El archivo no parece una copia de seguridad de PedagoGraph.',
      'Elige el archivo .zip que generó la app al hacer la copia de seguridad.'
    )
  }

  for (const entrada of entradas) {
    // Normaliza separadores (el zip usa '/') y previene "zip slip".
    const destino = resolve(join(raiz, entrada.name))
    if (destino !== raiz && !destino.startsWith(raiz + sep)) {
      throw new ErrorDeDominio('La copia de seguridad tiene rutas no válidas.')
    }
    const contenido = await entrada.async('nodebuffer')
    mkdirSync(dirname(destino), { recursive: true })
    writeFileSync(destino, contenido)
  }

  const reindex = reindexarVault(vault, repositorio)
  const tareas = vault.leerTodasTareas().length
  return { conceptos: reindex.conceptos, asignaturas: reindex.asignaturas, tareas }
}
