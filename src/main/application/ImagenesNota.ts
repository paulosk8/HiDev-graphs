import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { ErrorDeDominio } from '../domain/errores'
import type { Servicios } from '../servicios'

/**
 * Imágenes incrustadas en las notas de un concepto.
 *
 * El problema que resuelven: al pegar de Word o de una página web, las imágenes
 * llegan como una DIRECCIÓN que solo vale en el sitio de origen —un `file://`
 * temporal de Word, una URL de la web, un `vscode-resource` del visor—. La app
 * no puede cargar ninguna de las tres (su política de contenido solo admite
 * `data:` y `recurso:`), así que la nota acababa con el icono de imagen rota.
 *
 * Aquí se traen esos bytes UNA vez y se guardan junto al concepto. A partir de
 * ahí la nota apunta a `recurso://`, que siempre carga, funciona sin conexión y
 * viaja con el vault a otro equipo.
 */

/** Tope por imagen. Una captura ronda 1 MB; 15 evita que un PDF entero entre por error. */
const MAXIMO_BYTES = 15 * 1024 * 1024

const EXTENSION_POR_TIPO: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff'
}

function exigirConcepto(servicios: Servicios, conceptoId: string): void {
  if (!servicios.vault.existeConcepto(conceptoId)) {
    throw new ErrorDeDominio('No encontramos ese concepto.', 'Puede que ya se haya eliminado.')
  }
}

function exigirTamano(bytes: number): void {
  if (bytes > MAXIMO_BYTES) {
    throw new ErrorDeDominio(
      'Esa imagen es demasiado grande para incrustarla.',
      'Guárdala como material del concepto y enlázala desde la nota.'
    )
  }
}

/**
 * Guarda una imagen que ya está en el portapapeles (llega en base64 desde el
 * renderer, que es quien la lee del evento de pegado).
 */
export function guardarImagenDeNota(
  servicios: Servicios,
  conceptoId: string,
  nombre: string,
  base64: string
): { archivo: string } {
  exigirConcepto(servicios, conceptoId)
  // Acepta tanto un Data URI entero como el base64 pelado.
  const limpio = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64
  const datos = Buffer.from(limpio, 'base64')
  if (datos.length === 0) throw new ErrorDeDominio('Esa imagen llegó vacía.')
  exigirTamano(datos.length)
  return { archivo: servicios.vault.guardarImagenDeNota(conceptoId, nombre, datos) }
}

/**
 * Convierte a ruta local las direcciones que en realidad apuntan al disco.
 *
 * El visor de VS Code reescribe las rutas locales como
 * `https://file+.vscode-resource.vscode-cdn.net/Users/...`; pegando desde su
 * previsualización, eso es lo que llega. Se reconoce y se lee del disco en vez
 * de intentar descargarlo de una web que no existe.
 */
function rutaLocalDe(url: string): string | null {
  if (url.startsWith('file://')) {
    try {
      return fileURLToPath(url)
    } catch {
      return null
    }
  }
  if (url.startsWith('/')) return url
  const vscode = url.match(/^https?:\/\/[^/]*vscode-(?:resource|cdn)[^/]*(\/.*)$/)
  if (vscode) return decodeURIComponent(vscode[1].split('?')[0])
  return null
}

/** Extensión a partir del tipo declarado o, si no lo hay, de la propia dirección. */
function extensionDe(tipo: string | null, url: string): string {
  if (tipo) {
    const limpio = tipo.split(';')[0].trim().toLowerCase()
    if (EXTENSION_POR_TIPO[limpio]) return EXTENSION_POR_TIPO[limpio]
  }
  const enUrl = url.split('?')[0].match(/\.(png|jpe?g|gif|webp|svg|bmp|tiff?)$/i)
  return enUrl ? `.${enUrl[1].toLowerCase()}` : '.png'
}

/**
 * Trae la imagen de una dirección (web, archivo local o `vscode-resource`) y la
 * guarda junto al concepto. Devuelve la ruta relativa para escribirla en la nota.
 */
export async function guardarImagenDeUrlEnNota(
  servicios: Servicios,
  conceptoId: string,
  url: string
): Promise<{ archivo: string }> {
  exigirConcepto(servicios, conceptoId)

  const local = rutaLocalDe(url)
  if (local !== null) {
    let datos: Buffer
    try {
      datos = await readFile(local)
    } catch {
      throw new ErrorDeDominio(
        'No pudimos abrir esa imagen desde tu equipo.',
        'Si venía de otro programa, cópiala y pégala directamente.'
      )
    }
    exigirTamano(datos.length)
    return {
      archivo: servicios.vault.guardarImagenDeNota(
        conceptoId,
        `imagen${extensionDe(null, local)}`,
        datos
      )
    }
  }

  if (!/^https?:\/\//i.test(url)) {
    throw new ErrorDeDominio('Esa imagen no se puede traer.')
  }

  // Cortafuegos de tiempo: una web caída no puede dejar el pegado colgado.
  const corte = AbortSignal.timeout(15000)
  let respuesta: Response
  try {
    respuesta = await fetch(url, { signal: corte })
  } catch {
    throw new ErrorDeDominio(
      'No pudimos descargar esa imagen.',
      'Comprueba tu conexión, o pega la imagen directamente en vez del texto que la contiene.'
    )
  }
  if (!respuesta.ok) {
    throw new ErrorDeDominio('Esa imagen ya no está disponible en su dirección original.')
  }

  const tipo = respuesta.headers.get('content-type')
  if (tipo && !tipo.toLowerCase().startsWith('image/')) {
    throw new ErrorDeDominio('Esa dirección no es una imagen.')
  }
  const datos = Buffer.from(await respuesta.arrayBuffer())
  exigirTamano(datos.length)

  return {
    archivo: servicios.vault.guardarImagenDeNota(
      conceptoId,
      `imagen${extensionDe(tipo, url)}`,
      datos
    )
  }
}
