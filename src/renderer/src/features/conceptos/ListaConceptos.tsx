import { useMemo, useState } from 'react'
import type { ResumenConceptoDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { EstadoVacio } from '../../components/EstadoVacio'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'
import { FormularioConcepto } from './FormularioConcepto'

const SIN_ASIGNATURA = 'Sin asignatura'

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
  const [colapsados, setColapsados] = useState<Set<string>>(new Set())

  const filtrada = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q) return lista
    return lista.filter((c) => {
      const heno = normalizar(
        [c.nombre, c.descripcion, ...c.temas, ...c.asignaturas].filter(Boolean).join('  ')
      )
      return heno.includes(q)
    })
  }, [lista, busqueda])

  // Agrupa los conceptos por asignatura (uno puede aparecer en varias); los que
  // no se usan en ninguna van a "Sin asignatura", al final.
  const grupos = useMemo(() => {
    const mapa = new Map<string, ResumenConceptoDTO[]>()
    for (const c of filtrada) {
      const claves = c.asignaturas.length > 0 ? c.asignaturas : [SIN_ASIGNATURA]
      for (const clave of claves) {
        const arr = mapa.get(clave) ?? []
        arr.push(c)
        mapa.set(clave, arr)
      }
    }
    return [...mapa.entries()].sort((a, b) => {
      if (a[0] === SIN_ASIGNATURA) return 1
      if (b[0] === SIN_ASIGNATURA) return -1
      return a[0].localeCompare(b[0], 'es')
    })
  }, [filtrada])

  const alternarGrupo = (nombre: string): void =>
    setColapsados((prev) => {
      const s = new Set(prev)
      s.has(nombre) ? s.delete(nombre) : s.add(nombre)
      return s
    })

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
        <div className="space-y-3">
          {grupos.map(([asignatura, conceptos]) => {
            const cerrado = colapsados.has(asignatura)
            return (
              <section key={asignatura} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <button
                  onClick={() => alternarGrupo(asignatura)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-800">
                    {asignatura}{' '}
                    <span className="text-sm font-normal text-slate-400">({conceptos.length})</span>
                  </span>
                  <span className="text-slate-400">{cerrado ? '▸' : '▾'}</span>
                </button>
                {!cerrado && (
                  <ul className="divide-y divide-slate-100 border-t border-slate-100">
                    {conceptos.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => seleccionar(c.id)}
                          className="flex w-full flex-col items-start gap-1.5 px-4 py-2.5 text-left transition hover:bg-slate-50"
                        >
                          <div className="flex w-full items-center gap-3">
                            <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                              {c.nombre}
                            </span>
                            <span className="shrink-0 text-xs text-slate-400">
                              {c.totalRecursos === 0
                                ? 'Sin material'
                                : `${c.totalRecursos} ${c.totalRecursos === 1 ? 'material' : 'materiales'}`}
                            </span>
                          </div>
                          {c.temas.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {c.temas.slice(0, 5).map((t) => (
                                <span
                                  key={t}
                                  className="rounded-full bg-marca-50 px-2 py-0.5 text-[11px] text-marca-700"
                                >
                                  {t}
                                </span>
                              ))}
                              {c.temas.length > 5 && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                                  +{c.temas.length - 5}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] italic text-slate-400">Sin tema asignado</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

      {creando && (
        <FormularioConcepto onCerrar={() => setCreando(false)} onGuardado={(id) => seleccionar(id)} />
      )}
    </div>
  )
}
