import TurndownService from 'turndown'
// @ts-expect-error el paquete no trae tipos; la firma real es { gfm, tables, ... }
import { gfm } from 'turndown-plugin-gfm'

/**
 * Convierte HTML pegado (de Word, Google Docs, la web…) a Markdown, con soporte
 * de tablas (GFM). Así el docente pega contenido con formato y se guarda como
 * Markdown, que es el formato portable de las instrucciones de tarea.
 */
const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_'
})
turndown.use(gfm)

export function htmlAMarkdown(html: string): string {
  return turndown.turndown(html).trim()
}
