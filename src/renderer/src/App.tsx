import { useEffect, useState } from 'react'
import { api } from './lib/api'
import { Avisos } from './components/Avisos'
import { Sidebar } from './components/Sidebar'
import { PanelVistazo } from './components/PanelVistazo'
import { Bienvenida } from './features/bienvenida/Bienvenida'
import { SeleccionCapas } from './features/bienvenida/SeleccionCapas'
import { FichaConcepto } from './features/conceptos/FichaConcepto'
import { ListaConceptos } from './features/conceptos/ListaConceptos'
import { FichaAsignatura } from './features/asignaturas/FichaAsignatura'
import { ListaAsignaturas } from './features/asignaturas/ListaAsignaturas'
import { GrafoPage } from './features/grafo/GrafoPage'
import { LienzoPage } from './features/lienzo/LienzoPage'
import { AsistentePage } from './features/asistente/AsistentePage'
import {
  actualizarMaterial,
  respaldarMaterial,
  restaurarMaterial
} from './features/configuracion/accionesDatos'
import { ConfiguracionPage } from './features/configuracion/ConfiguracionPage'
import { ModoEstudioPage } from './features/estudio/ModoEstudioPage'
import { TerminalPage } from './features/terminal/TerminalPage'
import { useAsignaturasStore } from './stores/asignaturasStore'
import { useConceptosStore } from './stores/conceptosStore'
import { useEliminacionStore } from './stores/eliminacionStore'
import { TEMAS_OSCUROS, useLayoutStore } from './stores/layoutStore'
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

  if (seccion === 'lienzos') {
    return <LienzoPage />
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

/**
 * Atiende las opciones elegidas en la barra de menú del sistema. El menú vive
 * en el proceso principal y solo manda la intención; aquí se resuelve con la
 * misma API que usan los botones equivalentes de la interfaz.
 */
function useAccionesMenu(): void {
  useEffect(
    () =>
      api.onAccionMenu((accion) => {
        const { irASeccion, alternarConfiguracion, pedirIntencion, seccion } = useUiStore.getState()
        switch (accion) {
          case 'nuevo-concepto':
            irASeccion('conceptos')
            pedirIntencion('nuevo-concepto')
            break
          case 'nueva-asignatura':
            irASeccion('asignaturas')
            pedirIntencion('nueva-asignatura')
            break
          case 'ir-asignaturas':
            irASeccion('asignaturas')
            break
          case 'ir-conceptos':
            irASeccion('conceptos')
            break
          case 'ir-mapa':
            irASeccion('grafo')
            break
          case 'ir-repaso':
            irASeccion('estudio', 'aprendizaje')
            break
          case 'ir-asistente':
            irASeccion('asistente')
            break
          case 'ir-terminal':
            irASeccion('terminal')
            break
          case 'ir-configuracion':
            if (seccion !== 'configuracion') alternarConfiguracion()
            break
          case 'actualizar-material':
            void actualizarMaterial()
            break
          case 'respaldar':
            void respaldarMaterial()
            break
          case 'restaurar':
            void restaurarMaterial()
            break
          case 'zoom-mas':
            useLayoutStore.getState().ajustarZoom(1)
            break
          case 'zoom-menos':
            useLayoutStore.getState().ajustarZoom(-1)
            break
          case 'zoom-normal':
            useLayoutStore.getState().setZoom(100)
            break
        }
      }),
    []
  )
}

function App(): JSX.Element {
  useAccionesMenu()

  const cargarConceptos = useConceptosStore((s) => s.cargar)
  const cargarAsignaturas = useAsignaturasStore((s) => s.cargar)
  const cargarEliminacion = useEliminacionStore((s) => s.cargar)
  const tema = useLayoutStore((s) => s.tema)
  const zoomPorcentaje = useLayoutStore((s) => s.zoomPorcentaje)
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
    const raiz = document.documentElement
    // `dark` la comparten los dos temas oscuros; `contraste` y `calido` se
    // superponen encima, así no hay que duplicar las reglas de cada uno.
    raiz.classList.toggle('dark', TEMAS_OSCUROS.includes(tema))
    raiz.classList.toggle('contraste', tema === 'contraste' || tema === 'contraste-oscuro')
    raiz.classList.toggle('calido', tema === 'calido')
  }, [tema])

  // Tamaño de la interfaz. Se aplica con `zoom` en la raíz (no con el zoom de
  // Chromium) para que sea un único mecanismo, compartido por el control de
  // Apariencia y los atajos del menú, y quede guardado como una preferencia más.
  useEffect(() => {
    document.documentElement.style.zoom = `${zoomPorcentaje}%`
  }, [zoomPorcentaje])

  useEffect(() => {
    void cargarConceptos()
    void cargarAsignaturas()
    // Para que los avisos de "¿seguro que quieres eliminar?" digan la verdad.
    void cargarEliminacion()
  }, [cargarConceptos, cargarAsignaturas, cargarEliminacion])

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
      <PanelVistazo />
      <Avisos />
    </div>
  )
}

export default App
