import { useEffect } from 'react'
import { api } from './lib/api'
import { Avisos } from './components/Avisos'
import { Sidebar } from './components/Sidebar'
import { FichaConcepto } from './features/conceptos/FichaConcepto'
import { ListaConceptos } from './features/conceptos/ListaConceptos'
import { FichaAsignatura } from './features/asignaturas/FichaAsignatura'
import { ListaAsignaturas } from './features/asignaturas/ListaAsignaturas'
import { GrafoPage } from './features/grafo/GrafoPage'
import { AsistentePage } from './features/asistente/AsistentePage'
import { TerminalPage } from './features/terminal/TerminalPage'
import { useAsignaturasStore } from './stores/asignaturasStore'
import { useAuthStore } from './stores/authStore'
import { useConceptosStore } from './stores/conceptosStore'
import { useLayoutStore } from './stores/layoutStore'
import { useUiStore } from './stores/uiStore'
import { PantallaLogin } from './features/auth/PantallaLogin'

function Contenido(): JSX.Element {
  const seccion = useUiStore((s) => s.seccion)
  const conceptoSeleccionadoId = useUiStore((s) => s.conceptoSeleccionadoId)
  const asignaturaSeleccionadaId = useUiStore((s) => s.asignaturaSeleccionadaId)

  if (seccion === 'grafo') {
    return <GrafoPage />
  }

  if (seccion === 'asistente') {
    return <AsistentePage />
  }

  if (seccion === 'terminal') {
    return <TerminalPage />
  }

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
  const tema = useLayoutStore((s) => s.tema)
  const sesion = useAuthStore((s) => s.sesion)
  const cargandoSesion = useAuthStore((s) => s.cargando)
  const cargarSesion = useAuthStore((s) => s.cargar)

  // Aplica el tema (claro/oscuro) a la raíz del documento.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro')
  }, [tema])

  // Comprueba si hay sesión iniciada al arrancar (login obligatorio).
  useEffect(() => {
    void cargarSesion()
  }, [cargarSesion])

  useEffect(() => {
    void cargarConceptos()
    void cargarAsignaturas()
  }, [cargarConceptos, cargarAsignaturas])

  useEffect(() => {
    // Refresca las vistas cuando el vault cambia en segundo plano (sincronización).
    return api.onVaultCambiado(() => {
      void cargarConceptos()
      void cargarAsignaturas()
    })
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

  if (cargandoSesion) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 text-sm text-slate-400">
        Cargando…
      </div>
    )
  }

  if (!sesion) {
    return (
      <>
        <PantallaLogin />
        <Avisos />
      </>
    )
  }

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
