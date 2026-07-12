import { useEffect } from 'react'
import { Avisos } from './components/Avisos'
import { Sidebar } from './components/Sidebar'
import { FichaConcepto } from './features/conceptos/FichaConcepto'
import { ListaConceptos } from './features/conceptos/ListaConceptos'
import { FichaAsignatura } from './features/asignaturas/FichaAsignatura'
import { ListaAsignaturas } from './features/asignaturas/ListaAsignaturas'
import { useAsignaturasStore } from './stores/asignaturasStore'
import { useConceptosStore } from './stores/conceptosStore'
import { useUiStore } from './stores/uiStore'

function Contenido(): JSX.Element {
  const seccion = useUiStore((s) => s.seccion)
  const conceptoSeleccionadoId = useUiStore((s) => s.conceptoSeleccionadoId)
  const asignaturaSeleccionadaId = useUiStore((s) => s.asignaturaSeleccionadaId)

  if (seccion === 'asignaturas') {
    return asignaturaSeleccionadaId ? (
      <FichaAsignatura asignaturaId={asignaturaSeleccionadaId} />
    ) : (
      <ListaAsignaturas />
    )
  }

  return conceptoSeleccionadoId ? (
    <FichaConcepto conceptoId={conceptoSeleccionadoId} />
  ) : (
    <ListaConceptos />
  )
}

function App(): JSX.Element {
  const cargarConceptos = useConceptosStore((s) => s.cargar)
  const cargarAsignaturas = useAsignaturasStore((s) => s.cargar)

  useEffect(() => {
    void cargarConceptos()
    void cargarAsignaturas()
  }, [cargarConceptos, cargarAsignaturas])

  useEffect(() => {
    // Evita que soltar un archivo fuera de una zona válida haga navegar la app.
    const prevenir = (e: Event): void => e.preventDefault()
    window.addEventListener('dragover', prevenir)
    window.addEventListener('drop', prevenir)
    return () => {
      window.removeEventListener('dragover', prevenir)
      window.removeEventListener('drop', prevenir)
    }
  }, [])

  return (
    <div className="flex h-full text-slate-800">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Contenido />
      </main>
      <Avisos />
    </div>
  )
}

export default App
