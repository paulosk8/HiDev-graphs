import { marked } from 'marked'
import type { FormatoInstrucciones } from '@shared/dtos'
import { VistaCodigo } from './VistaCodigo'

/**
 * Renderiza contenido según su formato: Markdown (a HTML), HTML (en un iframe
 * aislado) o código (estilo editor). Reutilizado por tareas, notas de concepto
 * y el repaso, para que los tres formatos se vean igual en toda la app.
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
  if (!texto.trim()) {
    return <p className="text-sm text-slate-400">{vacio}</p>
  }
  if (formato === 'codigo') {
    return <VistaCodigo texto={texto} />
  }
  if (formato === 'html') {
    // El iframe SIEMPRE ocupa todo el ancho (w-full) y tiene un alto mínimo;
    // `className` solo añade estilos (antes lo reemplazaba y perdía el ancho).
    return (
      <iframe
        title="Contenido"
        sandbox="allow-scripts"
        srcDoc={texto}
        className={`min-h-[16rem] w-full rounded-lg border border-slate-200 bg-white ${className ?? ''}`}
      />
    )
  }
  return (
    <div
      className={`markdown-preview ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: marked.parse(texto) as string }}
    />
  )
}
