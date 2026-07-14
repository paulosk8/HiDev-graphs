import { useState, type ReactNode } from 'react'
import type { TipoAsignatura } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { EstadoVacio } from '../../components/EstadoVacio'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useUiStore, type Contexto } from '../../stores/uiStore'
import { AsistenteAsignatura } from './AsistenteAsignatura'

interface Props {
  contexto: Contexto
}

export function ListaAsignaturas({ contexto }: Props): JSX.Element {
  const lista = useAsignaturasStore((s) => s.lista)
  const cargando = useAsignaturasStore((s) => s.cargando)
  const seleccionar = useUiStore((s) => s.seleccionarAsignatura)
  const [creando, setCreando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [periodoFiltro, setPeriodoFiltro] = useState('')

  const esAprendizaje = contexto === 'aprendizaje'
  const tipo: TipoAsignatura = contexto

  // Solo las de este contexto (docencia o aprendizaje).
  const delContexto = lista.filter((a) =>
    esAprendizaje ? a.tipo === 'aprendizaje' : a.tipo !== 'aprendizaje'
  )

  const periodosDisponibles = [...new Set(delContexto.flatMap((a) => a.periodos))].sort()

  const filtradas = delContexto.filter(
    (a) =>
      a.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()) &&
      (periodoFiltro === '' || a.periodos.includes(periodoFiltro))
  )

  const textos = esAprendizaje
    ? {
        titulo: 'Aprendizaje',
        subtitulo: 'Abre un espacio para aprender algo nuevo con sus recursos.',
        crear: '+ Aprender algo',
        icono: '📘',
        vacioTitulo: 'Todavía no tienes espacios de aprendizaje',
        vacioDesc: 'Crea un espacio para aprender un tema nuevo y organizar su material.',
        vacioCrear: '+ Aprender algo'
      }
    : {
        titulo: 'Mis asignaturas',
        subtitulo: 'Prepara y organiza las clases de tus asignaturas.',
        crear: '+ Nueva asignatura',
        icono: '🎓',
        vacioTitulo: 'Todavía no tienes asignaturas',
        vacioDesc: 'Crea una asignatura para organizar tus clases, unidades y temas.',
        vacioCrear: '+ Crear mi primera asignatura'
      }

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{textos.titulo}</h1>
          <p className="mt-1 text-sm text-slate-500">{textos.subtitulo}</p>
        </div>
        <Boton variante="primario" onClick={() => setCreando(true)}>
          {textos.crear}
        </Boton>
      </header>

      {cargando ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
      ) : delContexto.length === 0 ? (
        <EstadoVacio icono={textos.icono} titulo={textos.vacioTitulo} descripcion={textos.vacioDesc}>
          <Boton variante="primario" onClick={() => setCreando(true)}>
            {textos.vacioCrear}
          </Boton>
        </EstadoVacio>
      ) : (
        <>
          {/* Buscar + filtrar por período (el período solo aplica a docencia) */}
          <div className="mb-5 space-y-3">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre…"
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
              Nada coincide con la búsqueda.
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
                      {!esAprendizaje && asig.periodos.length > 0 && (
                        <span className="text-xs font-medium text-marca-600">
                          {asig.periodos.join(', ')}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 text-xs text-slate-400">
                      {asig.totalUnidades}{' '}
                      {esAprendizaje
                        ? asig.totalUnidades === 1 ? 'bloque' : 'bloques'
                        : asig.totalUnidades === 1 ? 'tema' : 'temas'}{' '}
                      · {asig.totalTemas}{' '}
                      {esAprendizaje
                        ? asig.totalTemas === 1 ? 'tema' : 'temas'
                        : asig.totalTemas === 1 ? 'subtema' : 'subtemas'}{' '}
                      · {asig.totalTareas}{' '}
                      {esAprendizaje
                        ? asig.totalTareas === 1
                          ? 'práctica'
                          : 'prácticas'
                        : asig.totalTareas === 1
                          ? 'tarea'
                          : 'tareas'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {creando && (
        <AsistenteAsignatura
          tipo={tipo}
          onCerrar={() => setCreando(false)}
          onCreada={(id) => seleccionar(id)}
        />
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
