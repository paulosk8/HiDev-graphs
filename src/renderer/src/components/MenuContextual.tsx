import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Menú del clic derecho, propio de la aplicación (no el nativo del sistema).
 *
 * Por qué no el nativo: las opciones de mover necesitan enseñar el destino y
 * dejar BUSCARLO. Un menú nativo solo admite submenús anidados —asignatura ›
 * unidad › tema—, que con unas pocas asignaturas se vuelve impracticable y
 * obliga al docente a recordar dónde estaba cada cosa. Con un menú propio, la
 * opción "Mover a…" abre el mismo buscador con autocompletado que ya se usa
 * para vincular conceptos.
 *
 * El menú se posiciona en el cursor y se recoloca si se saldría de la ventana.
 */
export interface OpcionMenu {
  etiqueta: string
  icono?: string
  onElegir: () => void
  /** Se pinta en rojo (eliminar) y se separa del resto. */
  destructiva?: boolean
  deshabilitada?: boolean
  /** Explica por qué está deshabilitada, en lenguaje humano. */
  motivo?: string
}

export function MenuContextual({
  x,
  y,
  opciones,
  onCerrar
}: {
  x: number
  y: number
  opciones: OpcionMenu[]
  onCerrar: () => void
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  // Se mide DESPUÉS de pintar y antes de que el navegador dibuje, para que no
  // se vea el salto si hay que recolocarlo.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const caja = el.getBoundingClientRect()
    const margen = 8
    setPos({
      x: Math.min(x, window.innerWidth - caja.width - margen),
      y: Math.min(y, window.innerHeight - caja.height - margen)
    })
  }, [x, y])

  useEffect(() => {
    const cerrarFuera = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) onCerrar()
    }
    const conEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCerrar()
    }
    // `capture` para adelantarse a los clics de la propia lista de debajo.
    document.addEventListener('mousedown', cerrarFuera, true)
    document.addEventListener('keydown', conEscape)
    window.addEventListener('resize', onCerrar)
    // Un scroll dejaría el menú flotando lejos de su elemento.
    window.addEventListener('scroll', onCerrar, true)
    return () => {
      document.removeEventListener('mousedown', cerrarFuera, true)
      document.removeEventListener('keydown', conEscape)
      window.removeEventListener('resize', onCerrar)
      window.removeEventListener('scroll', onCerrar, true)
    }
  }, [onCerrar])

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 min-w-[13rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
    >
      {opciones.map((o, i) => (
        <button
          key={o.etiqueta}
          role="menuitem"
          type="button"
          disabled={o.deshabilitada}
          title={o.deshabilitada ? o.motivo : undefined}
          onClick={() => {
            o.onElegir()
            onCerrar()
          }}
          className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition ${
            o.destructiva ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
          } disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent ${
            // Separa visualmente la acción destructiva de las demás.
            o.destructiva && i > 0 ? 'mt-1 border-t border-slate-100 pt-2' : ''
          }`}
        >
          {o.icono && (
            <span aria-hidden className="w-4 text-center">
              {o.icono}
            </span>
          )}
          {o.etiqueta}
        </button>
      ))}
    </div>,
    document.body
  )
}

/**
 * Estado del menú contextual con el dato sobre el que se abrió. Se saca a un
 * hook para que cada lista no repita las mismas cuatro líneas.
 */
export function useMenuContextual<T>(): {
  menu: { x: number; y: number; dato: T } | null
  abrir: (evento: React.MouseEvent, dato: T) => void
  cerrar: () => void
} {
  const [menu, setMenu] = useState<{ x: number; y: number; dato: T } | null>(null)
  return {
    menu,
    abrir: (evento, dato) => {
      evento.preventDefault()
      evento.stopPropagation()
      setMenu({ x: evento.clientX, y: evento.clientY, dato })
    },
    cerrar: () => setMenu(null)
  }
}

/** Envoltorio para elementos de lista que responden al clic derecho. */
export function ConMenuContextual({
  children,
  onMenu,
  className
}: {
  children: ReactNode
  onMenu: (evento: React.MouseEvent) => void
  className?: string
}): JSX.Element {
  return (
    <div onContextMenu={onMenu} className={className}>
      {children}
    </div>
  )
}
