import { protocol } from 'electron'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

import type { VaultFileSystemService } from './infrastructure/VaultFileSystemService'

const ESQUEMA = 'recurso'

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
}

/**
 * Registra el esquema `recurso://` como privilegiado. DEBE llamarse antes de que
 * la app esté lista (a nivel de módulo del proceso principal).
 */
export function registrarEsquemaRecursoPrivilegiado(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ESQUEMA,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

/**
 * Sirve archivos del vault por `recurso://c/<conceptoId>/<archivo>` para
 * previsualizarlos (PDF, HTML, imágenes) sin exponer el sistema de archivos ni
 * relajar la seguridad. Valida que la ruta quede dentro del vault.
 */
export function habilitarProtocoloRecurso(vault: VaultFileSystemService): void {
  protocol.handle(ESQUEMA, async (peticion) => {
    try {
      const url = new URL(peticion.url)
      const partes = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
      if (url.hostname !== 'c' || partes.length < 2) {
        return new Response('No encontrado', { status: 404 })
      }
      const [conceptoId, ...resto] = partes
      const archivo = resto.join('/')

      const ruta = vault.rutaRecurso(conceptoId, archivo)
      if (ruta === null) return new Response('No encontrado', { status: 404 })

      const datos = await readFile(ruta)
      const tipo = MIME[extname(archivo).toLowerCase()] ?? 'application/octet-stream'
      return new Response(new Uint8Array(datos), { headers: { 'content-type': tipo } })
    } catch {
      return new Response('No encontrado', { status: 404 })
    }
  })
}
