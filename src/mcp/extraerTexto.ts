/**
 * Extrae el texto plano de un material didáctico según su formato, para que la
 * IA razone sobre su contenido. Librerías puras JS (sin módulos nativos),
 * cargadas de forma perezosa (solo la del formato pedido).
 */
import { readFile } from 'node:fs/promises'
import type { FormatoRecurso } from '../main/domain/tipos'

function limpiarHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function extraerPdf(ruta: string): Promise<string> {
  const { getDocumentProxy, extractText } = await import('unpdf')
  const datos = new Uint8Array(await readFile(ruta))
  const pdf = await getDocumentProxy(datos)
  const { text } = await extractText(pdf, { mergePages: true })
  return Array.isArray(text) ? text.join('\n') : text
}

async function extraerDocx(ruta: string): Promise<string> {
  const mammoth = (await import('mammoth')).default
  const { value } = await mammoth.extractRawText({ buffer: await readFile(ruta) })
  return value
}

async function extraerPptx(ruta: string): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await readFile(ruta))
  const diapositivas = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort()
  const partes: string[] = []
  for (const nombre of diapositivas) {
    const xml = await zip.file(nombre)!.async('string')
    const textos = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1])
    if (textos.length) partes.push(textos.join(' '))
  }
  return partes.join('\n\n')
}

export async function extraerTexto(ruta: string, formato: FormatoRecurso): Promise<string> {
  switch (formato) {
    case 'md':
    case 'xml':
      return readFile(ruta, 'utf8')
    case 'html':
      return limpiarHtml(await readFile(ruta, 'utf8'))
    case 'pdf':
      return extraerPdf(ruta)
    case 'docx':
      return extraerDocx(ruta)
    case 'pptx':
      return extraerPptx(ruta)
    default:
      return ''
  }
}
