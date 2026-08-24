import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { FormatoInstrucciones } from '@shared/dtos'
import { BarraFormato } from './BarraFormato'

/** Tabla de doble entrada, que es la forma que toma una rúbrica en Markdown. */
const PLANTILLA_TABLA = '\n| Criterio | Puntos |\n| --- | --- |\n| … | … |\n| … | … |\n'

const ATAJOS_MARKDOWN = [
  { etiqueta: 'Título', frag: '\n## Título\n' },
  { etiqueta: 'Subtítulo', frag: '\n### Subtítulo\n' },
  { etiqueta: 'Lista', frag: '\n- \n' },
  { etiqueta: 'Tabla / rúbrica', frag: PLANTILLA_TABLA },
  { etiqueta: 'Enlace', frag: '[texto](https://…)' },
  { etiqueta: 'Negrita', frag: '**texto**' }
]

/**
 * Herramientas de escritura de un `<textarea>`: color, resaltado, contenido
 * incrustado y atajos de Markdown.
 *
 * Vive aquí y no dentro del formulario de tareas porque las notas de un concepto
 * escriben exactamente el mismo Markdown. Duplicarlas era garantizar que se
 * separaran: el docente aprendería una barra en las tareas y no la encontraría
 * al escribir una nota.
 *
 * El editor es un área de texto, no un procesador: «poner color» es envolver lo
 * seleccionado en un `<span style="color:…">`, que funciona igual en Markdown y
 * en HTML porque el Markdown de la app admite HTML dentro.
 */
export function HerramientasTexto({
  formato,
  areaRef,
  valor,
  onCambiar
}: {
  formato: FormatoInstrucciones
  areaRef: RefObject<HTMLTextAreaElement>
  valor: string
  onCambiar: Dispatch<SetStateAction<string>>
}): JSX.Element | null {
  /** Inserta en la posición del cursor (o al final si no hay foco). */
  const insertar = (texto: string): void => {
    const el = areaRef.current
    const inicio = el?.selectionStart ?? valor.length
    const fin = el?.selectionEnd ?? valor.length
    onCambiar(valor.slice(0, inicio) + texto + valor.slice(fin))
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const pos = inicio + texto.length
      el.setSelectionRange(pos, pos)
    })
  }

  /**
   * Envuelve lo seleccionado (o inserta un ejemplo si no hay selección). Es lo
   * que hace falta para dar color a «lo que acabo de escribir».
   */
  const envolver = (antes: string, despues: string, ejemplo: string): void => {
    const el = areaRef.current
    const inicio = el?.selectionStart ?? valor.length
    const fin = el?.selectionEnd ?? valor.length
    const seleccion = valor.slice(inicio, fin) || ejemplo
    const nuevo = antes + seleccion + despues
    onCambiar(valor.slice(0, inicio) + nuevo + valor.slice(fin))
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      // Deja seleccionado lo coloreado, para poder seguir escribiendo encima.
      el.setSelectionRange(inicio + antes.length, inicio + antes.length + seleccion.length)
    })
  }

  // En modo código el texto no se interpreta: colorear ahí no significaría nada.
  if (formato === 'codigo') {
    return (
      <p className="mb-1.5 text-xs text-slate-500">
        Modo código: el texto se guarda y se ve tal cual, sin interpretarlo.
      </p>
    )
  }

  return (
    <>
      <BarraFormato
        onEnvolver={envolver}
        onInsertar={insertar}
        mostrarIncrustado={formato === 'html'}
      />
      {formato === 'markdown' ? (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {ATAJOS_MARKDOWN.map((b) => (
            <button
              key={b.etiqueta}
              type="button"
              onClick={() => insertar(b.frag)}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
            >
              {b.etiqueta}
            </button>
          ))}
        </div>
      ) : (
        <p className="mb-1.5 text-xs text-slate-500">
          Modo HTML: pega o escribe HTML; admite <code>&lt;style&gt;</code>,{' '}
          <code>&lt;script&gt;</code> y contenido incrustado con <code>&lt;iframe&gt;</code>{' '}
          (Excalidraw, YouTube, GeoGebra…). Se guarda tal cual para copiarlo en Moodle.
        </p>
      )}
    </>
  )
}
