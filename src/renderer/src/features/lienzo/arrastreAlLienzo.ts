/**
 * Arrastrar contenido del panel lateral al lienzo.
 *
 * El arrastre HTML5 no transporta objetos: solo texto. Por eso el dato viaja
 * serializado en `dataTransfer` bajo un tipo propio, y se lee al soltar. Se usa
 * un tipo `application/...` y no `text/plain` para que soltar texto de fuera
 * (del navegador, de Word) no se confunda con una tarjeta.
 */

export const TIPO_ARRASTRE = 'application/pedagograph-lienzo'

export type ContenidoArrastrado =
  | { tipo: 'concepto'; conceptoId: string }
  | { tipo: 'nota'; conceptoId: string; notaId: string }
  | { tipo: 'material'; conceptoId: string; archivo: string }

/** Prepara el dato en el evento de inicio de arrastre. */
export function empezarArrastreDe(
  evento: React.DragEvent,
  contenido: ContenidoArrastrado
): void {
  evento.dataTransfer.setData(TIPO_ARRASTRE, JSON.stringify(contenido))
  // `copy` pinta el cursor con un "+": no se está moviendo nada del panel, se
  // está creando una tarjeta en el lienzo.
  evento.dataTransfer.effectAllowed = 'copy'
}

/** Lee el dato al soltar; null si lo soltado no es contenido nuestro. */
export function leerArrastre(evento: React.DragEvent): ContenidoArrastrado | null {
  const crudo = evento.dataTransfer.getData(TIPO_ARRASTRE)
  if (!crudo) return null
  try {
    const d = JSON.parse(crudo) as ContenidoArrastrado
    if (d?.tipo === 'concepto' && d.conceptoId) return d
    if (d?.tipo === 'nota' && d.conceptoId && d.notaId) return d
    if (d?.tipo === 'material' && d.conceptoId && d.archivo) return d
    return null
  } catch {
    return null
  }
}
