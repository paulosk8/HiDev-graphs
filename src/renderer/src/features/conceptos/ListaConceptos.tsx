import { useMemo, useState } from 'react'
import { Boton } from '../../components/Boton'
import { EstadoVacio } from '../../components/EstadoVacio'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'
import { FormularioConcepto } from './FormularioConcepto'

/** Normaliza para buscar sin distinguir mayúsculas ni acentos. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    // Elimina marcas diacríticas combinantes (U+0300–U+036F).
    .replace(/[̀-ͯ]/g, '')
}

export function ListaConceptos(): JSX.Element {
  const lista = useConceptosStore((s) => s.lista)
  const cargando = useConceptosStore((s) => s.cargando)
  const seleccionar = useUiStore((s) => s.seleccionarConcepto)
  const [creando, setCreando] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const filtrada = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q) return lista
    return lista.filter((c) => {
      const heno = normalizar(
        [c.nombre, c.descripcion, ...c.temas].filter(Boolean).join('  ')
      )
      return heno.includes(q)
    })
  }, [lista, busqueda])

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Conceptos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tus ideas reutilizables y el material de cada una.
          </p>
        </div>
        <Boton variante="primario" onClick={() => setCreando(true)}>
          + Nuevo concepto
        </Boton>
      </header>

      {!cargando && lista.length > 0 && (
        <div className="mb-5">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, descripción o tema…"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-marca-400 focus:outline-none focus:ring-2 focus:ring-marca-100"
          />
        </div>
      )}

      {cargando ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
      ) : lista.length === 0 ? (
        <EstadoVacio
          icono="💡"
          titulo="Todavía no tienes conceptos"
          descripcion="Crea tu primer concepto para empezar a organizar tu material y reutilizarlo entre asignaturas."
        >
          <Boton variante="primario" onClick={() => setCreando(true)}>
            + Crear mi primer concepto
          </Boton>
        </EstadoVacio>
      ) : filtrada.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          Ningún concepto coincide con «{busqueda}».
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtrada.map((concepto) => (
            <li key={concepto.id}>
              <button
                onClick={() => seleccionar(concepto.id)}
                className="flex h-full w-full flex-col items-start rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-marca-300 hover:shadow-sm"
              >
                <span className="font-medium text-slate-800">{concepto.nombre}</span>
                {concepto.descripcion && (
                  <span className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {concepto.descripcion}
                  </span>
                )}
                <span className="mt-1 text-xs text-slate-400">
                  {concepto.totalRecursos === 0
                    ? 'Sin material'
                    : `${concepto.totalRecursos} ${concepto.totalRecursos === 1 ? 'material' : 'materiales'}`}
                </span>
                {concepto.temas.length > 0 && (
                  <span className="mt-2 flex flex-wrap gap-1">
                    {concepto.temas.slice(0, 3).map((t, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-marca-50 px-2 py-0.5 text-[11px] text-marca-700"
                      >
                        {t}
                      </span>
                    ))}
                    {concepto.temas.length > 3 && (
                      <span className="px-1 text-[11px] text-slate-400">
                        +{concepto.temas.length - 3}
                      </span>
                    )}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {creando && (
        <FormularioConcepto onCerrar={() => setCreando(false)} onGuardado={(id) => seleccionar(id)} />
      )}
    </div>
  )
}
