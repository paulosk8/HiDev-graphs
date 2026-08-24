import type { ClipboardEvent, Dispatch, RefObject, SetStateAction } from 'react'
import type { FormatoInstrucciones } from '@shared/dtos'
import { api } from './api'
import { htmlAMarkdown } from './markdown'

/** Lee un archivo (imagen) como Data URI base64 para incrustarlo autocontenido. */
export function leerComoDataUri(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(lector.result as string)
    lector.onerror = () => reject(lector.error)
    lector.readAsDataURL(archivo)
  })
}

interface OpcionesPegado {
  formato: FormatoInstrucciones
  ref: RefObject<HTMLTextAreaElement>
  setValor: Dispatch<SetStateAction<string>>
  /**
   * Concepto dueño de la nota, si lo hay. Con él, las imágenes pegadas se
   * guardan como archivos junto al concepto y la nota apunta a `recurso://`.
   * Sin él (instrucciones de una tarea) se incrustan en base64, que es
   * autocontenido y es lo que conviene al exportarlas.
   */
  conceptoId?: string
  /** Se llama con un mensaje humano si alguna imagen no se pudo traer. */
  onAviso?: (mensaje: string) => void
}

/** Direcciones que la aplicación SÍ puede pintar tal cual. */
function yaSePuedeVer(src: string): boolean {
  return src.startsWith('data:') || src.startsWith('recurso://')
}

/**
 * Maneja el pegado rico en un `<textarea>`:
 *  - Imágenes del portapapeles → archivo junto al concepto (o base64).
 *  - HTML con formato (Word, Google Docs, web) → se convierte a Markdown, o se
 *    pega tal cual en modo HTML (con sus tablas), trayendo antes sus imágenes.
 *  - En modo «código» o texto plano se deja el pegado por defecto.
 *
 * Por qué se traen las imágenes: al pegar de Word o de la web, cada `<img>`
 * llega con una dirección que solo vale en el sitio de origen (un `file://`
 * temporal, una URL, un `vscode-resource`). La política de contenido de la app
 * no carga ninguna, así que la nota mostraba el icono de imagen rota. Se traen
 * una vez y se guardan; a partir de ahí la nota se ve siempre, también sin
 * conexión y en otro equipo.
 *
 * Reutilizado por el editor de tareas y por las notas de concepto.
 */
export function manejarPegadoRico(
  e: ClipboardEvent<HTMLTextAreaElement>,
  { formato, ref, setValor, conceptoId, onAviso }: OpcionesPegado
): void {
  if (formato === 'codigo') return // el código se pega literal

  const el = ref.current
  const inicio = el?.selectionStart ?? el?.value.length ?? 0
  const fin = el?.selectionEnd ?? el?.value.length ?? 0
  const insertar = (frag: string): void =>
    setValor((prev) => prev.slice(0, inicio) + frag + prev.slice(fin))

  const marcaDe = (src: string, alt: string): string =>
    formato === 'html'
      ? `<img src="${src}" alt="${alt}" style="max-width:100%">`
      : `\n![${alt}](${src})\n`

  // 1) Imágenes del portapapeles.
  const imagenes: File[] = []
  for (const item of Array.from(e.clipboardData.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile()
      if (f) imagenes.push(f)
    }
  }
  if (imagenes.length > 0) {
    e.preventDefault()
    void (async () => {
      const marcas: string[] = []
      for (const [i, archivo] of imagenes.entries()) {
        const dataUri = await leerComoDataUri(archivo)
        if (!conceptoId) {
          marcas.push(marcaDe(dataUri, 'imagen'))
          continue
        }
        try {
          const { archivo: ruta } = await api.guardarImagenDeNota(
            conceptoId,
            archivo.name || `imagen-${i + 1}.png`,
            dataUri
          )
          marcas.push(marcaDe(`recurso://c/${conceptoId}/${ruta}`, 'imagen'))
        } catch {
          // Si no se pudo guardar, mejor incrustada que perdida.
          marcas.push(marcaDe(dataUri, 'imagen'))
        }
      }
      insertar(marcas.join(''))
    })()
    return
  }

  // 2) HTML con formato (tablas incluidas).
  const html = e.clipboardData.getData('text/html')
  if (html && html.trim()) {
    e.preventDefault()
    void (async () => {
      const { html: resuelto, fallidas } = await traerImagenes(html, conceptoId)
      insertar(formato === 'html' ? resuelto : `${htmlAMarkdown(resuelto)}\n`)
      if (fallidas > 0) {
        onAviso?.(
          fallidas === 1
            ? 'Una imagen del texto pegado no se pudo traer y se dejó su descripción.'
            : `${fallidas} imágenes del texto pegado no se pudieron traer y se dejó su descripción.`
        )
      }
    })()
  }
  // Sin HTML ni imagen (texto plano): pegado por defecto.
}

/**
 * Reescribe las `<img>` del HTML pegado para que apunten a algo que la app
 * pueda pintar. Las que no se puedan traer se sustituyen por su texto
 * alternativo: es más útil leer «Árbol de carpetas…» que ver un icono roto.
 */
async function traerImagenes(
  html: string,
  conceptoId: string | undefined
): Promise<{ html: string; fallidas: number }> {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const imgs = [...doc.querySelectorAll('img')]
  if (imgs.length === 0) return { html, fallidas: 0 }

  let fallidas = 0
  for (const img of imgs) {
    const src = img.getAttribute('src') ?? ''
    const alt = img.getAttribute('alt') ?? ''

    if (!src || (yaSePuedeVer(src) && !conceptoId)) continue

    if (conceptoId) {
      try {
        const { archivo } = await api.guardarImagenDeNotaDesdeUrl(conceptoId, src)
        img.setAttribute('src', `recurso://c/${conceptoId}/${archivo}`)
        continue
      } catch {
        /* se intenta la vía de abajo */
      }
    }

    // Sin concepto (una tarea) solo vale lo autocontenido; y si tampoco se pudo
    // guardar, se deja el texto alternativo en vez de una imagen rota.
    if (yaSePuedeVer(src)) continue
    fallidas += 1
    const reemplazo = doc.createElement('em')
    reemplazo.textContent = alt || 'imagen no disponible'
    img.replaceWith(reemplazo)
  }

  return { html: doc.body.innerHTML, fallidas }
}
