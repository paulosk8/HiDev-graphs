import { useState } from 'react'
import { Boton } from '../../components/Boton'
import { EstadoVacio } from '../../components/EstadoVacio'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'
import { FormularioConcepto } from './FormularioConcepto'

export function ListaConceptos(): JSX.Element {
  const lista = useConceptosStore((s) => s.lista)
  const cargando = useConceptosStore((s) => s.cargando)
  const seleccionar = useUiStore((s) => s.seleccionarConcepto)
  const [creando, setCreando] = useState(false)

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
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lista.map((concepto) => (
            <li key={concepto.id}>
              <button
                onClick={() => seleccionar(concepto.id)}
                className="flex w-full flex-col items-start rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-marca-300 hover:shadow-sm"
              >
                <span className="font-medium text-slate-800">{concepto.nombre}</span>
                <span className="mt-1 text-xs text-slate-400">
                  {concepto.totalRecursos === 0
                    ? 'Sin material'
                    : `${concepto.totalRecursos} ${concepto.totalRecursos === 1 ? 'material' : 'materiales'}`}
                </span>
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
