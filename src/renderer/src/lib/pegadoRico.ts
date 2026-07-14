import type { ClipboardEvent, Dispatch, RefObject, SetStateAction } from 'react'
import type { FormatoInstrucciones } from '@shared/dtos'
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
}

/**
 * Maneja el pegado rico en un `<textarea>`:
 *  - Imágenes del portapapeles → se incrustan como base64 (viajan con el texto).
 *  - HTML con formato (Word, Google Docs, web) → se convierte a Markdown, o se
 *    pega tal cual en modo HTML (con sus tablas).
 *  - En modo «código» o texto plano se deja el pegado por defecto.
 *
 * Reutilizado por el editor de tareas y por las notas de concepto.
 */
export function manejarPegadoRico(
  e: ClipboardEvent<HTMLTextAreaElement>,
  { formato, ref, setValor }: OpcionesPegado
): void {
  if (formato === 'codigo') return // el código se pega literal

  const el = ref.current
  const inicio = el?.selectionStart ?? el?.value.length ?? 0
  const fin = el?.selectionEnd ?? el?.value.length ?? 0
  const insertar = (frag: string): void =>
    setValor((prev) => prev.slice(0, inicio) + frag + prev.slice(fin))

  // 1) Imágenes → base64.
  const imagenes: File[] = []
  for (const item of Array.from(e.clipboardData.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile()
      if (f) imagenes.push(f)
    }
  }
  if (imagenes.length > 0) {
    e.preventDefault()
    void Promise.all(imagenes.map(leerComoDataUri)).then((uris) => {
      insertar(
        uris
          .map((u) =>
            formato === 'html'
              ? `<img src="${u}" alt="imagen" style="max-width:100%">`
              : `\n![imagen](${u})\n`
          )
          .join('')
      )
    })
    return
  }

  // 2) HTML con formato (tablas incluidas): tal cual en HTML, o convertido a Markdown.
  const html = e.clipboardData.getData('text/html')
  if (html && html.trim()) {
    e.preventDefault()
    insertar(formato === 'html' ? html : `${htmlAMarkdown(html)}\n`)
  }
  // Sin HTML ni imagen (texto plano): pegado por defecto.
}
