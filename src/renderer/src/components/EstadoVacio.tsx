import type { ReactNode } from 'react'

interface Props {
  icono?: string
  titulo: string
  descripcion?: string
  children?: ReactNode
}

/** Bloque centrado para cuando aún no hay contenido, con una acción opcional. */
export function EstadoVacio({ icono = '📚', titulo, descripcion, children }: Props): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 py-14 text-center">
      <div className="mb-3 text-3xl" aria-hidden>
        {icono}
      </div>
      <h3 className="text-base font-semibold text-slate-800">{titulo}</h3>
      {descripcion && <p className="mt-1 max-w-sm text-sm text-slate-500">{descripcion}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  )
}
