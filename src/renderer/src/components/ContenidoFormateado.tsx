import { marked } from 'marked'
import { useCallback } from 'react'
import type { FormatoInstrucciones } from '@shared/dtos'
import { sustituirEnlaces } from '../lib/enlacesWiki'
import { useConceptosStore } from '../stores/conceptosStore'
import { useVistazoStore } from '../stores/vistazoStore'
import { VistaCodigo } from './VistaCodigo'
import { VistaHtml } from './VistaHtml'

/**
 * Renderiza contenido según su formato: Markdown (a HTML), HTML (en un iframe
 * aislado) o código (estilo editor). Reutilizado por tareas, notas de concepto
 * y el repaso, para que los tres formatos se vean igual en toda la app.
 *
 * En Markdown reconoce además los enlaces `[[Concepto]]` y los convierte en
 * algo pulsable que abre el panel de vistazo.
 */
export function ContenidoFormateado({
  texto,
  formato,
  vacio = 'Sin contenido.',
  className
}: {
  texto: string
  formato: FormatoInstrucciones
  /** Mensaje cuando no hay contenido. */
  vacio?: string
  /** Clases extra para el contenedor (markdown/iframe). */
  className?: string
}): JSX.Element {
  const conceptos = useConceptosStore((s) => s.lista)
  const abrirVistazo = useVistazoStore((s) => s.abrir)

  /**
   * Un solo escuchador en el contenedor en vez de uno por enlace: el HTML se
   * inyecta como cadena, así que no hay componentes React a los que atarlos.
   */
  const alPulsar = useCallback(
    (evento: React.MouseEvent<HTMLDivElement>): void => {
      const destino = (evento.target as HTMLElement).closest('[data-concepto-id]')
      const id = destino?.getAttribute('data-concepto-id')
      if (id) {
        evento.preventDefault()
        abrirVistazo(id)
      }
    },
    [abrirVistazo]
  )

  if (!texto.trim()) {
    return <p className="text-sm text-slate-400">{vacio}</p>
  }
  if (formato === 'codigo') {
    return <VistaCodigo texto={texto} />
  }
  if (formato === 'html') {
    // El iframe SIEMPRE ocupa todo el ancho (w-full) y tiene un alto mínimo;
    // `className` solo añade estilos (antes lo reemplazaba y perdía el ancho).
    return <VistaHtml html={texto} className={className} />
  }

  // Los `[[...]]` se sustituyen ANTES de convertir el Markdown: así el enlace
  // ya llega como HTML y `marked` lo respeta tal cual.
  const conEnlaces = sustituirEnlaces(texto, (nombre) => {
    const encontrado = conceptos.find(
      (c) => c.nombre.localeCompare(nombre, 'es', { sensitivity: 'base' }) === 0
    )
    return encontrado ? { id: encontrado.id, nombre: encontrado.nombre } : null
  })

  return (
    <div
      onClick={alPulsar}
      className={`markdown-preview ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: marked.parse(conEnlaces) as string }}
    />
  )
}
