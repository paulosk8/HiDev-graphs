import { useEffect, useState } from 'react'
import type { RecursoDTO } from '@shared/dtos'
import { api } from '../../lib/api'
import { useConceptosStore } from '../../stores/conceptosStore'

/**
 * Elegir un material para ponerlo en el lienzo: primero el concepto, luego uno
 * de sus archivos.
 *
 * Se hace en dos pasos y no con una lista única de todos los archivos del
 * vault porque el material solo tiene sentido junto a su concepto: "el PDF de
 * Cormen" no dice nada; "el PDF de Cormen, de Divide y vencerás", sí.
 */
export function SelectorMaterial({
  onElegir,
  onCerrar
}: {
  onElegir: (conceptoId: string, recurso: RecursoDTO) => void
  onCerrar: () => void
}): JSX.Element {
  const conceptos = useConceptosStore((s) => s.lista)
  const [busqueda, setBusqueda] = useState('')
  const [conceptoId, setConceptoId] = useState<string | null>(null)
  const [recursos, setRecursos] = useState<RecursoDTO[] | null>(null)

  useEffect(() => {
    if (!conceptoId) return
    let vivo = true
    setRecursos(null)
    void api
      .obtenerFichaConcepto(conceptoId)
      .then((f) => vivo && setRecursos(f.concepto.recursos))
      .catch(() => vivo && setRecursos([]))
    return () => {
      vivo = false
    }
  }, [conceptoId])

  const normalizar = (t: string): string =>
    t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const filtrados = conceptos.filter(
    (c) => !busqueda.trim() || normalizar(c.nombre).includes(normalizar(busqueda))
  )
  const elegido = conceptos.find((c) => c.id === conceptoId)

  return (
    <div className="w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        {conceptoId && (
          <button
            onClick={() => setConceptoId(null)}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            ←
          </button>
        )}
        <p className="flex-1 truncate text-xs text-slate-500">
          {elegido ? `Material de «${elegido.nombre}»` : 'Elige el concepto'}
        </p>
        <button onClick={onCerrar} className="text-slate-400 hover:text-slate-700" aria-label="Cerrar">
          ✕
        </button>
      </div>

      {!conceptoId ? (
        <>
          <input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar concepto…"
            className="w-full border-b border-slate-100 px-3 py-2 text-sm outline-none"
          />
          <ul className="max-h-64 overflow-auto">
            {filtrados.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setConceptoId(c.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span className="flex-1 truncate">{c.nombre}</span>
                  {/* Se avisa de los que no tienen nada, para no entrar en balde. */}
                  <span className="text-xs text-slate-400">
                    {c.totalRecursos > 0 ? `📎 ${c.totalRecursos}` : 'sin material'}
                  </span>
                </button>
              </li>
            ))}
            {filtrados.length === 0 && (
              <li className="px-3 py-3 text-sm text-slate-400">Ningún concepto coincide.</li>
            )}
          </ul>
        </>
      ) : recursos === null ? (
        <p className="px-3 py-3 text-sm text-slate-400">Cargando…</p>
      ) : recursos.length === 0 ? (
        <p className="px-3 py-3 text-sm text-slate-400">Este concepto no tiene material todavía.</p>
      ) : (
        <ul className="max-h-64 overflow-auto">
          {recursos.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => onElegir(conceptoId, r)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                  {r.formato}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-slate-700">{r.nombre}</span>
                  {r.carpeta && (
                    <span className="block truncate text-[10px] text-slate-400">📁 {r.carpeta}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
