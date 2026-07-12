import { useEffect } from 'react'
import { useUiStore, type Aviso, type TipoAviso } from '../stores/uiStore'

const ESTILO: Record<TipoAviso, string> = {
  exito: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-slate-200 bg-white text-slate-800'
}

const ICONO: Record<TipoAviso, string> = { exito: '✓', error: '⚠', info: 'ℹ' }

function Tarjeta({ aviso }: { aviso: Aviso }): JSX.Element {
  const descartar = useUiStore((s) => s.descartarAviso)

  useEffect(() => {
    const t = setTimeout(() => descartar(aviso.id), aviso.tipo === 'error' ? 7000 : 4000)
    return () => clearTimeout(t)
  }, [aviso.id, aviso.tipo, descartar])

  return (
    <div className={`pointer-events-auto flex gap-3 rounded-lg border px-4 py-3 shadow-sm ${ESTILO[aviso.tipo]}`}>
      <span aria-hidden className="mt-0.5 text-sm font-bold">
        {ICONO[aviso.tipo]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{aviso.mensaje}</p>
        {aviso.sugerencia && <p className="mt-0.5 text-xs opacity-80">{aviso.sugerencia}</p>}
      </div>
      <button
        onClick={() => descartar(aviso.id)}
        className="text-sm opacity-60 transition hover:opacity-100"
        aria-label="Cerrar aviso"
      >
        ✕
      </button>
    </div>
  )
}

/** Pila de avisos (toasts) en la esquina inferior derecha. */
export function Avisos(): JSX.Element {
  const avisos = useUiStore((s) => s.avisos)
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {avisos.map((aviso) => (
        <Tarjeta key={aviso.id} aviso={aviso} />
      ))}
    </div>
  )
}
