import { useState } from 'react'
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

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Mis asignaturas</h1>
          <p className="mt-1 text-sm text-slate-500">Tus asignaturas por período académico.</p>
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
          descripcion="Crea tu primera asignatura con el asistente: nombre, componentes, y sus unidades y temas."
        >
          <Boton variante="primario" onClick={() => setCreando(true)}>
            + Crear mi primera asignatura
          </Boton>
        </EstadoVacio>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lista.map((asig) => (
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
                  {asig.totalTemas} {asig.totalTemas === 1 ? 'tema' : 'temas'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {creando && (
        <AsistenteAsignatura
          onCerrar={() => setCreando(false)}
          onCreada={(id) => seleccionar(id)}
        />
      )}
    </div>
  )
}
