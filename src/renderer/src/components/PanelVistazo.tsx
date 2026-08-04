import { useEffect, useState } from 'react'
import type { ConceptoDTO } from '@shared/dtos'
import { api } from '../lib/api'
import { useUiStore } from '../stores/uiStore'
import { useVistazoStore } from '../stores/vistazoStore'
import { ContenidoFormateado } from './ContenidoFormateado'

/**
 * Panel lateral de vistazo: enseña el concepto enlazado sin sacarte de donde
 * estabas leyendo. Se abre al pulsar un `[[enlace]]`.
 *
 * Detalles pensados para no perderse:
 *  - "← volver" recorre la pila de enlaces que has ido abriendo.
 *  - Escape cierra el panel entero.
 *  - "Abrir ficha completa" es la salida explícita cuando ya quieres irte ahí.
 */
export function PanelVistazo(): JSX.Element | null {
  const pila = useVistazoStore((s) => s.pila)
  const volver = useVistazoStore((s) => s.volver)
  const cerrar = useVistazoStore((s) => s.cerrar)
  const irAConcepto = useUiStore((s) => s.seleccionarConcepto)
  const irASeccion = useUiStore((s) => s.irASeccion)

  const conceptoId = pila[pila.length - 1] ?? null
  const [concepto, setConcepto] = useState<ConceptoDTO | null>(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!conceptoId) {
      setConcepto(null)
      return
    }
    let vivo = true
    setCargando(true)
    void api
      .obtenerFichaConcepto(conceptoId)
      .then((f) => vivo && setConcepto(f.concepto))
      .catch(() => vivo && setConcepto(null))
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [conceptoId])

  useEffect(() => {
    if (!conceptoId) return
    const alTeclear = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [conceptoId, cerrar])

  if (!conceptoId) return null

  const abrirFicha = (): void => {
    irASeccion('conceptos')
    irAConcepto(conceptoId)
    cerrar()
  }

  return (
    <aside
      // No es un modal: el panel convive con la lectura, no la tapa. Por eso no
      // hay velo oscuro detrás ni se bloquea el resto de la interfaz.
      className="fixed right-0 top-0 z-40 flex h-full w-[22rem] flex-col border-l border-slate-200 bg-white shadow-xl"
      aria-label="Vistazo al concepto"
    >
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        {pila.length > 1 && (
          <button
            onClick={volver}
            className="text-sm text-slate-500 transition hover:text-slate-800"
            title="Volver al concepto anterior"
          >
            ←
          </button>
        )}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
          {concepto?.nombre ?? (cargando ? 'Cargando…' : 'No encontrado')}
        </h2>
        <button
          onClick={cerrar}
          className="text-slate-400 transition hover:text-slate-700"
          aria-label="Cerrar el vistazo"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4">
        {cargando ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : !concepto ? (
          <p className="text-sm text-slate-500">
            Este concepto ya no existe. Puede que se haya eliminado o cambiado de nombre.
          </p>
        ) : (
          <>
            {concepto.descripcion && (
              <p className="text-sm text-slate-600">{concepto.descripcion}</p>
            )}

            {concepto.etiquetas.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {concepto.etiquetas.map((e) => (
                  <span
                    key={e}
                    className="rounded-full bg-marca-50 px-2 py-0.5 text-xs font-medium text-marca-700"
                  >
                    {e}
                  </span>
                ))}
              </div>
            )}

            {concepto.notas.length > 0 && (
              <section className="mt-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Notas
                </h3>
                <div className="space-y-3">
                  {concepto.notas.map((n) => (
                    <div key={n.id} className="rounded-lg border border-slate-100 p-3">
                      {n.titulo && (
                        <p className="mb-1 text-sm font-medium text-slate-800">{n.titulo}</p>
                      )}
                      {/* El contenido puede traer más [[enlaces]]: se siguen
                          dentro del propio panel, apilándose. */}
                      <ContenidoFormateado texto={n.contenido} formato={n.formato} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {concepto.recursos.length > 0 && (
              <section className="mt-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Material
                </h3>
                <ul className="space-y-1.5">
                  {concepto.recursos.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                        {r.formato}
                      </span>
                      <span className="truncate">{r.nombre}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!concepto.descripcion &&
              concepto.notas.length === 0 &&
              concepto.recursos.length === 0 && (
                <p className="text-sm text-slate-400">
                  Este concepto todavía no tiene descripción, notas ni material.
                </p>
              )}
          </>
        )}
      </div>

      {concepto && (
        <footer className="border-t border-slate-100 px-4 py-3">
          <button
            onClick={abrirFicha}
            className="w-full rounded-lg bg-marca-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-marca-700"
          >
            Abrir ficha completa
          </button>
        </footer>
      )}
    </aside>
  )
}
