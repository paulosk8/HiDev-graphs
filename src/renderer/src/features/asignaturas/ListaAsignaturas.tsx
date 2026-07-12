import { useState, type ReactNode } from 'react'
import { Boton } from '../../components/Boton'
import { EstadoVacio } from '../../components/EstadoVacio'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useUiStore } from '../../stores/uiStore'
import { AsistenteAsignatura } from './AsistenteAsignatura'

export function ListaAsignaturas(): JSX.Element {
  const lista = useAsignaturasStore((s) => s.lista)
  const cargando = useAsignaturasStore((s) => s.cargando)
  const seleccionar = useUiStore((s) => s.seleccionarAsignatura)
  const [creando, setCreando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [periodoFiltro, setPeriodoFiltro] = useState('')

  const periodosDisponibles = [...new Set(lista.flatMap((a) => a.periodos))].sort()

  const filtradas = lista.filter(
    (a) =>
      a.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()) &&
      (periodoFiltro === '' || a.periodos.includes(periodoFiltro))
  )

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Mis asignaturas</h1>
          <p className="mt-1 text-sm text-slate-500">La misma asignatura puede dictarse en varios períodos.</p>
        </div>
        <Boton variante="primario" onClick={() => setCreando(true)}>
          + Nueva asignatura
        </Boton>
      </header>

      {cargando ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
      ) : lista.length === 0 ? (
        <EstadoVacio
          icono="🎓"
          titulo="Todavía no tienes asignaturas"
          descripcion="Crea tu primera asignatura con el asistente: nombre, períodos, componentes, y sus unidades y temas."
        >
          <Boton variante="primario" onClick={() => setCreando(true)}>
            + Crear mi primera asignatura
          </Boton>
        </EstadoVacio>
      ) : (
        <>
          {/* Buscar + filtrar por período */}
          <div className="mb-5 space-y-3">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar asignatura por nombre…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
            />
            {periodosDisponibles.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-slate-400">Período:</span>
                <ChipPeriodo activo={periodoFiltro === ''} onClick={() => setPeriodoFiltro('')}>
                  Todos
                </ChipPeriodo>
                {periodosDisponibles.map((p) => (
                  <ChipPeriodo
                    key={p}
                    activo={periodoFiltro === p}
                    onClick={() => setPeriodoFiltro(p)}
                  >
                    {p}
                  </ChipPeriodo>
                ))}
              </div>
            )}
          </div>

          {filtradas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              Ninguna asignatura coincide con la búsqueda.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filtradas.map((asig) => (
                <li key={asig.id}>
                  <button
                    onClick={() => seleccionar(asig.id)}
                    className="flex w-full flex-col items-start rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-marca-300 hover:shadow-sm"
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="font-medium text-slate-800">{asig.nombre}</span>
                      <span className="text-xs font-medium text-marca-600">
                        {asig.periodos.join(', ')}
                      </span>
                    </span>
                    <span className="mt-1 text-xs text-slate-400">
                      {asig.totalUnidades} {asig.totalUnidades === 1 ? 'unidad' : 'unidades'} ·{' '}
                      {asig.totalTemas} {asig.totalTemas === 1 ? 'tema' : 'temas'} ·{' '}
                      {asig.totalTareas} {asig.totalTareas === 1 ? 'tarea' : 'tareas'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {creando && (
        <AsistenteAsignatura onCerrar={() => setCreando(false)} onCreada={(id) => seleccionar(id)} />
      )}
    </div>
  )
}

function ChipPeriodo({
  activo,
  onClick,
  children
}: {
  activo: boolean
  onClick: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        activo ? 'bg-marca-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  )
}
