import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Ancho = 'md' | 'lg' | 'xl'

const ANCHO: Record<Ancho, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl'
}

interface Props {
  titulo: string
  descripcion?: string
  ancho?: Ancho
  onCerrar: () => void
  children: ReactNode
}

/** Ventana modal centrada. Se cierra con Escape o clic fuera del panel. */
export function Modal({ titulo, descripcion, ancho = 'md', onCerrar, children }: Props): JSX.Element {
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [onCerrar])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={onCerrar}
    >
      <div
        className={`max-h-[85vh] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-2xl ${ANCHO[ancho]}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
        {descripcion && <p className="mt-1 text-sm text-slate-500">{descripcion}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}
