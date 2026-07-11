import { useEffect, useState } from 'react'
import { api } from './lib/api'

interface Conteos {
  conceptos: number
  asignaturas: number
}

function App(): JSX.Element {
  const [conteos, setConteos] = useState<Conteos | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Prueba extremo a extremo del puente IPC: renderer -> preload -> main -> índice.
    Promise.all([api.listarConceptos(), api.listarAsignaturas()])
      .then(([conceptos, asignaturas]) => {
        setConteos({ conceptos: conceptos.length, asignaturas: asignaturas.length })
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error al cargar los datos.'))
  }, [])

  return (
    <div className="flex h-full text-slate-800">
      {/* Barra lateral (se llena en los bloques de UI) */}
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-slate-50 p-5">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-marca-600 text-sm font-bold text-white">
            P
          </div>
          <span className="text-lg font-semibold">PedagoGraph</span>
        </div>

        <nav className="space-y-1 text-sm">
          <div className="flex items-center justify-between rounded-md px-3 py-2 font-medium text-slate-500">
            <span>Mis asignaturas</span>
            <span className="text-xs text-slate-400">{conteos?.asignaturas ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between rounded-md px-3 py-2 font-medium text-slate-500">
            <span>Conceptos</span>
            <span className="text-xs text-slate-400">{conteos?.conceptos ?? '—'}</span>
          </div>
        </nav>
      </aside>

      {/* Área central de contenido */}
      <main className="flex flex-1 items-center justify-center p-10">
        <div className="max-w-md text-center">
          <h1 className="mb-3 text-2xl font-semibold text-slate-900">
            Bienvenido a PedagoGraph
          </h1>
          <p className="text-slate-500">
            Organiza tu material por conceptos y reutilízalo entre tus
            asignaturas. Pronto podrás crear tu primer concepto y tu primera
            asignatura desde aquí.
          </p>

          {error ? (
            <p className="mt-6 text-sm text-red-600">{error}</p>
          ) : (
            <p className="mt-6 text-xs text-slate-400">
              {conteos
                ? `Todo listo · ${conteos.conceptos} conceptos y ${conteos.asignaturas} asignaturas`
                : 'Conectando con tu material…'}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
