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
 * Sitios que el docente puede incrustar con `<iframe>` en su contenido HTML.
 *
 * Es una lista cerrada a propósito: el contenido puede venir de una plantilla,
 * de otro docente o generado por IA, y una lista evita que cargue cualquier
 * cosa sin que nadie lo haya decidido. Ampliarla es añadir una línea.
 */
const SITIOS_INCRUSTABLES = [
  'https://excalidraw.com',
  'https://*.excalidraw.com',
  'https://*.youtube.com',
  'https://*.youtube-nocookie.com',
  'https://player.vimeo.com',
  'https://www.geogebra.org',
  'https://*.geogebra.org',
  'https://drive.google.com',
  'https://docs.google.com',
  'https://view.genially.com'
]

/**
 * Política de seguridad del contenido del docente. Permite lo que necesita un
 * material rico (estilos y scripts propios, imágenes incrustadas en base64) y
 * limita los `<iframe>` a los sitios de arriba.
 */
const CSP_CONTENIDO = [
  "default-src 'self' 'unsafe-inline' data:",
  "script-src 'unsafe-inline' 'unsafe-eval'",
  "style-src 'unsafe-inline'",
  'img-src data: blob: https:',
  'media-src data: blob: https:',
  'font-src data: https:',
  `frame-src ${SITIOS_INCRUSTABLES.join(' ')}`,
  `child-src ${SITIOS_INCRUSTABLES.join(' ')}`,
  'connect-src https:'
].join('; ')

/**
 * Documento anfitrión donde se pinta el contenido HTML que escribe el docente.
 *
 * Existe por una razón de seguridad concreta. Ese contenido puede llevar
 * `<iframe>` (un esquema de Excalidraw, un vídeo…), y las restricciones del
 * `sandbox` **se heredan** a los iframes anidados: sin `allow-same-origin` el
 * incrustado no puede acceder a su propio origen y se queda en blanco. Pero si
 * el contenido se inyectara con `srcDoc`, `allow-same-origin` lo pondría en el
 * MISMO origen que la app, y un HTML pegado de un tercero podría alcanzar
 * `window.parent` y la API interna.
 *
 * Sirviéndolo desde `recurso://contenido/` obtiene un **origen propio**: se
 * puede relajar el sandbox lo justo para que los incrustados funcionen, y aun
 * así el contenido no tiene forma de tocar PedagoGraph.
 *
 * El HTML no viaja en la URL ni se guarda aquí: llega por `postMessage` desde
 * el visor, que lo manda en cuanto el documento carga.
 */
const ANFITRION_CONTENIDO = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; }
      body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
      /* Un incrustado sin tamaño propio (caso típico de Excalidraw) llena el ancho. */
      iframe { max-width: 100%; border: 0; }
      img, svg, video { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>
    <script>
      // Un único mensaje del visor con el contenido a pintar. Se acepta
      // cualquier origen porque este documento no tiene nada que proteger: no
      // guarda datos y su origen ya está aislado del de la aplicación.
      addEventListener('message', function (evento) {
        var datos = evento && evento.data
        if (!datos || datos.tipo !== 'pedagograph:contenido') return
        document.open()
        document.write(String(datos.html || ''))
        document.close()
      })
      // Avisa al visor de que ya puede mandar el contenido.
      if (window.parent !== window) {
        window.parent.postMessage({ tipo: 'pedagograph:listo' }, '*')
      }
    </script>
  </body>
</html>
`

/**
 * Sirve archivos del vault por `recurso://c/<conceptoId>/<archivo>` para
 * previsualizarlos (PDF, HTML, imágenes) sin exponer el sistema de archivos ni
 * relajar la seguridad. Valida que la ruta quede dentro del vault.
 *
 * `recurso://contenido/` devuelve el anfitrión de arriba (documento fijo).
 */
export function habilitarProtocoloRecurso(vault: VaultFileSystemService): void {
  protocol.handle(ESQUEMA, async (peticion) => {
    try {
      const url = new URL(peticion.url)

      if (url.hostname === 'contenido') {
        return new Response(ANFITRION_CONTENIDO, {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            // Va como CABECERA, no como <meta>: el anfitrión se pinta con
            // document.write, que borra el <head> y se llevaría por delante una
            // meta. La cabecera sigue aplicando al documento tras reescribirlo.
            'content-security-policy': CSP_CONTENIDO
          }
        })
      }

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
