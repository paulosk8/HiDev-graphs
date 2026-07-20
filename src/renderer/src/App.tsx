import { useEffect, useState } from 'react'
import { api } from './lib/api'
import { Avisos } from './components/Avisos'
import { Sidebar } from './components/Sidebar'
import { Bienvenida } from './features/bienvenida/Bienvenida'
import { SeleccionCapas } from './features/bienvenida/SeleccionCapas'
import { FichaConcepto } from './features/conceptos/FichaConcepto'
import { ListaConceptos } from './features/conceptos/ListaConceptos'
import { FichaAsignatura } from './features/asignaturas/FichaAsignatura'
import { ListaAsignaturas } from './features/asignaturas/ListaAsignaturas'
import { GrafoPage } from './features/grafo/GrafoPage'
import { AsistentePage } from './features/asistente/AsistentePage'
import { ConfiguracionPage } from './features/configuracion/ConfiguracionPage'
import { ModoEstudioPage } from './features/estudio/ModoEstudioPage'
import { TerminalPage } from './features/terminal/TerminalPage'
import { useAsignaturasStore } from './stores/asignaturasStore'
import { useConceptosStore } from './stores/conceptosStore'
import { useLayoutStore } from './stores/layoutStore'
import { useUiStore } from './stores/uiStore'

function Contenido(): JSX.Element {
  const seccion = useUiStore((s) => s.seccion)
  const contexto = useUiStore((s) => s.contexto)
  const conceptoSeleccionadoId = useUiStore((s) => s.conceptoSeleccionadoId)
  const asignaturaSeleccionadaId = useUiStore((s) => s.asignaturaSeleccionadaId)

  if (seccion === 'grafo') {
    return <GrafoPage contexto={contexto} />
  }

  if (seccion === 'estudio') {
    return <ModoEstudioPage />
  }

  if (seccion === 'configuracion') {
    return <ConfiguracionPage />
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
      <ListaAsignaturas contexto={contexto} />
    )
  }

  return conceptoSeleccionadoId ? (
    <FichaConcepto conceptoId={conceptoSeleccionadoId} />
  ) : (
    <ListaConceptos contexto={contexto} />
  )
}

function App(): JSX.Element {
  const cargarConceptos = useConceptosStore((s) => s.cargar)
  const cargarAsignaturas = useAsignaturasStore((s) => s.cargar)
  const tema = useLayoutStore((s) => s.tema)
  const capasElegidas = useLayoutStore((s) => s.capasElegidas)

  // ¿Ya eligió el docente dónde guardar su material? Si no, mostramos la
  // pantalla de bienvenida (null = aún comprobando).
  const [configurado, setConfigurado] = useState<boolean | null>(null)
  useEffect(() => {
    void api
      .estadoAlmacenamiento()
      .then((e) => setConfigurado(e.configurado))
      .catch(() => setConfigurado(true)) // ante un fallo, no bloqueamos la app
  }, [])

  // Aplica el tema (claro/oscuro) a la raíz del documento.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro')
  }, [tema])

  useEffect(() => {
    void cargarConceptos()
    void cargarAsignaturas()
  }, [cargarConceptos, cargarAsignaturas])

  useEffect(() => {
    // Refresca las vistas cuando el material cambia en segundo plano (p. ej. tu
    // nube baja cambios desde otro equipo y el vault se actualiza).
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

  // Mientras comprobamos la configuración, no parpadeamos contenido.
  if (configurado === null) {
    return <div className="h-full bg-slate-50" />
  }

  // Primer arranque, paso 1: elegir dónde guardar el material.
  if (!configurado) {
    return (
      <>
        <Bienvenida onListo={() => setConfigurado(true)} />
        <Avisos />
      </>
    )
  }

  // Primer arranque, paso 2: elegir qué capas ver (Docencia / Aprendizaje).
  if (!capasElegidas) {
    return (
      <>
        <SeleccionCapas />
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
