import { createWriteStream, existsSync } from 'node:fs'

import type { Servicios } from '../servicios'

/**
 * Crea un archivo .zip con todo el contenido del vault (conceptos y asignaturas,
 * con su material) en `rutaDestino`. No incluye el índice, porque es
 * reconstruible. El diálogo de "Guardar como" lo abre la capa IPC (Electron).
 *
 * Devuelve el número de bytes del respaldo. Usa importación dinámica porque
 * archiver es un módulo ESM y el proceso principal se empaqueta como CommonJS.
 */
export async function respaldarVault(servicios: Servicios, rutaDestino: string): Promise<number> {
  const { vault } = servicios
  const { ZipArchive } = await import('archiver')

  return new Promise<number>((resolver, rechazar) => {
    const salida = createWriteStream(rutaDestino)
    const zip = new ZipArchive({ zlib: { level: 9 } })

    salida.on('close', () => resolver(zip.pointer()))
    zip.on('warning', (err) => {
      if (err.code !== 'ENOENT') rechazar(err)
    })
    zip.on('error', (err) => rechazar(err))

    zip.pipe(salida)
    if (existsSync(vault.dirConceptos)) zip.directory(vault.dirConceptos, 'conceptos')
    if (existsSync(vault.dirAsignaturas)) zip.directory(vault.dirAsignaturas, 'asignaturas')
    void zip.finalize()
  })
}
