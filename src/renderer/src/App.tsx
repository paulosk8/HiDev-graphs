function App(): JSX.Element {
  return (
    <div className="flex h-full text-slate-800">
      {/* Barra lateral (estructura provisional; se llena en bloques siguientes) */}
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-slate-50 p-5">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-marca-600 text-sm font-bold text-white">
            P
          </div>
          <span className="text-lg font-semibold">PedagoGraph</span>
        </div>

        <nav className="space-y-1 text-sm">
          <div className="rounded-md px-3 py-2 font-medium text-slate-400">
            Mis asignaturas
          </div>
          <div className="rounded-md px-3 py-2 font-medium text-slate-400">
            Conceptos
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
          <p className="mt-6 text-xs text-slate-400">
            Instalación correcta · versión 0.1.0
          </p>
        </div>
      </main>
    </div>
  )
}

export default App
