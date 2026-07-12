import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import {
  ETIQUETAS_RELACION,
  type FichaConceptoDTO,
  type GrafoDTO,
  type NodoGrafoDTO,
  type TipoAristaGrafo,
  type UsoDeConceptoDTO
} from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { Modal } from '../../components/Modal'
import { TerminalEmbebida } from '../terminal/TerminalEmbebida'
import { CombinarTareasDialog } from '../tareas/CombinarTareasDialog'
import { api } from '../../lib/api'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'
import { useLayoutStore } from '../../stores/layoutStore'

cytoscape.use(fcose)

const TIPOS_ARISTA: { tipo: TipoAristaGrafo; etiqueta: string; color: string }[] = [
  { tipo: 'coocurre', etiqueta: 'Se enseñan juntos', color: '#818cf8' },
  { tipo: 'usado_en', etiqueta: 'Usado en', color: '#cbd5e1' },
  { tipo: 'prerequisito_de', etiqueta: ETIQUETAS_RELACION.prerequisito_de, color: '#ef4444' },
  { tipo: 'relacionado_con', etiqueta: ETIQUETAS_RELACION.relacionado_con, color: '#64748b' },
  { tipo: 'profundiza', etiqueta: ETIQUETAS_RELACION.profundiza, color: '#10b981' }
]
const ETIQUETA_ARISTA: Record<string, string> = Object.fromEntries(TIPOS_ARISTA.map((t) => [t.tipo, t.etiqueta]))

/** Paleta para colorear los conceptos relacionados con el seleccionado. */
const PALETA = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#a855f7']

const truncar = (s: string, n = 22): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

const ESTILO: cytoscape.StylesheetStyle[] = [
  {
    selector: 'node[tipo="concepto"]',
    style: {
      label: 'data(etiqueta)',
      'font-size': 10,
      color: '#334155',
      'text-valign': 'bottom',
      'text-margin-y': 4,
      'text-wrap': 'wrap',
      'text-max-width': '90px',
      'background-color': '#6366f1',
      shape: 'ellipse',
      width: 'data(tam)',
      height: 'data(tam)'
    }
  },
  {
    // Sin etiqueta dentro del grafo: el nombre va en un tooltip al pasar el ratón.
    selector: 'node[tipo="asignatura"]',
    style: {
      label: '',
      'background-color': '#94a3b8',
      'border-color': '#475569',
      'border-width': 1.5,
      shape: 'round-rectangle',
      width: 26,
      height: 18
    }
  },
  {
    // Tareas: rombo ámbar, sin etiqueta (el título va en el tooltip).
    selector: 'node[tipo="tarea"]',
    style: {
      label: '',
      'background-color': '#f59e0b',
      'border-color': '#b45309',
      'border-width': 1.5,
      shape: 'diamond',
      width: 16,
      height: 16
    }
  },
  { selector: 'edge', style: { 'curve-style': 'bezier', width: 1.5, 'line-color': '#cbd5e1' } },
  { selector: 'edge[tipo="coocurre"]', style: { 'line-color': '#818cf8', 'line-style': 'dashed' } },
  { selector: 'edge[tipo="tarea_concepto"]', style: { 'line-color': '#f59e0b', 'line-style': 'dotted', width: 1 } },
  { selector: 'edge[tipo="prerequisito_de"]', style: { 'line-color': '#ef4444', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#ef4444' } },
  { selector: 'edge[tipo="relacionado_con"]', style: { 'line-color': '#64748b' } },
  { selector: 'edge[tipo="profundiza"]', style: { 'line-color': '#10b981', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#10b981' } },
  { selector: '.atenuado', style: { opacity: 0.1 } },
  { selector: 'node.foco', style: { 'border-width': 3, 'border-color': '#4338ca' } },
  { selector: 'node.combinar', style: { 'border-width': 4, 'border-color': '#059669' } }
]

function elementosVisibles(
  grafo: GrafoDTO,
  tipos: Set<TipoAristaGrafo>,
  mostrarTareas: boolean,
  asignaturasFiltro: Set<string>
): cytoscape.ElementDefinition[] {
  const filtrar = asignaturasFiltro.size > 0
  // Conceptos usados en las asignaturas filtradas (vía aristas 'usado_en').
  const conceptosPermitidos = new Set<string>()
  if (filtrar) {
    for (const a of grafo.aristas) {
      if (a.tipo === 'usado_en' && a.asignaturaId && asignaturasFiltro.has(a.asignaturaId)) {
        conceptosPermitidos.add(a.origen)
      }
    }
  }
  const nodoVisible = (n: NodoGrafoDTO): boolean => {
    if (n.tipo === 'tarea' && !mostrarTareas) return false
    if (!filtrar) return true
    if (n.tipo === 'asignatura') return asignaturasFiltro.has(n.id.slice(2))
    if (n.tipo === 'concepto') return conceptosPermitidos.has(n.id)
    if (n.tipo === 'tarea') return !!n.asignaturaId && asignaturasFiltro.has(n.asignaturaId)
    return true
  }

  const nodos = grafo.nodos.filter(nodoVisible)
  const idsVisibles = new Set(nodos.map((n) => n.id))
  const aristas = grafo.aristas.filter((a) => {
    const tipoOk = a.tipo === 'tarea_concepto' ? mostrarTareas : tipos.has(a.tipo)
    return tipoOk && idsVisibles.has(a.origen) && idsVisibles.has(a.destino)
  })
  return [
    ...nodos.map((n) => ({
      data: {
        id: n.id,
        // El nombre completo se ve en el panel y el tooltip; en el grafo se trunca.
        etiqueta: n.tipo === 'concepto' ? truncar(n.etiqueta) : n.etiqueta,
        completa: n.etiqueta,
        tipo: n.tipo,
        asignaturaId: n.asignaturaId,
        tam: n.tipo === 'concepto' ? Math.min(24 + n.peso * 8, 64) : 22
      }
    })),
    ...aristas.map((a) => ({
      data: { id: `${a.origen}__${a.destino}__${a.tipo}`, source: a.origen, target: a.destino, tipo: a.tipo }
    }))
  ]
}

/** Conceptos conectados a `conceptoId` (con la relación que los une). */
function relacionadosDe(grafo: GrafoDTO, conceptoId: string): { id: string; etiqueta: string; via: string }[] {
  const yo = `c:${conceptoId}`
  const etiquetaDe = new Map(grafo.nodos.map((n) => [n.id, n.etiqueta]))
  const vistos = new Map<string, { id: string; etiqueta: string; via: string }>()
  for (const a of grafo.aristas) {
    let otro: string | null = null
    if (a.origen === yo && a.destino.startsWith('c:')) otro = a.destino
    else if (a.destino === yo && a.origen.startsWith('c:')) otro = a.origen
    if (!otro || vistos.has(otro)) continue
    vistos.set(otro, { id: otro.slice(2), etiqueta: etiquetaDe.get(otro) ?? otro.slice(2), via: ETIQUETA_ARISTA[a.tipo] ?? a.tipo })
  }
  return [...vistos.values()]
}

/** Plantillas de prompt para el CLI de IA, rellenadas con la selección actual. */
interface Plantilla {
  clave: string
  titulo: string
  resumen: string
  construir: (conceptos: string[], temas: string[]) => string
}

function listaConceptos(conceptos: string[]): string {
  return conceptos.length === 0 ? 'los conceptos seleccionados' : conceptos.map((c) => `"${c}"`).join(', ')
}
function fraseTemas(temas: string[]): string {
  return temas.length > 0 ? ` Céntrate en estos temas: ${temas.join('; ')}.` : ''
}
/**
 * Cierre común: obliga a la IA a REGISTRAR el resultado como tarea en el vault
 * con `crear_tarea`, no a dejarlo como texto suelto o artefacto propio del CLI.
 */
function fraseGuardar(temas: string[]): string {
  const dondeTemas =
    temas.length > 0 ? ` para los temas ${temas.join('; ')}` : ' para los temas donde se usan estos conceptos'
  return (
    ` Al terminar, GUÁRDALO en PedagoGraph con la herramienta crear_tarea${dondeTemas} ` +
    `(usa usos_de_concepto para elegir la asignatura correcta) y pon todo el contenido en el campo ` +
    `de instrucciones en Markdown. No lo dejes solo como texto ni como artefacto del CLI.`
  )
}

const PLANTILLAS: Plantilla[] = [
  {
    clave: 'tarea',
    titulo: 'Tarea integradora',
    resumen: 'Una tarea que integre los conceptos relacionados y su material.',
    construir: (c, t) =>
      `Usando las herramientas de PedagoGraph (MCP), crea una tarea que integre ${listaConceptos(c)}. ` +
      `Consulta dónde se usan (usos_de_concepto) y su material (leer_material) y redacta las instrucciones.` +
      `${fraseTemas(t)}${fraseGuardar(t)}`
  },
  {
    clave: 'recurso',
    titulo: 'Recurso didáctico',
    resumen: 'Una guía, resumen o ejercicios que conecte los temas relacionados.',
    construir: (c, t) =>
      `Con el material de ${listaConceptos(c)} (usa leer_material), elabora un recurso didáctico ` +
      `(guía, resumen o ejercicios) en Markdown que conecte los temas relacionados.` +
      `${fraseTemas(t)}${fraseGuardar(t)}`
  },
  {
    clave: 'multi',
    titulo: 'Actividad multi-asignatura',
    resumen: 'Una actividad reutilizable entre las asignaturas que comparten estos conceptos.',
    construir: (c) =>
      `Revisa dónde se usan ${listaConceptos(c)} (usos_de_concepto y cruces_entre_asignaturas) y diseña ` +
      `una actividad reutilizable entre las asignaturas y períodos que los comparten. ` +
      `Guárdala con crear_tarea en una de esas asignaturas (poniendo el contenido en las instrucciones en ` +
      `Markdown) y luego duplícala a las demás con duplicar_tarea. No la dejes solo como texto ni como artefacto del CLI.`
  },
  {
    clave: 'evaluacion',
    titulo: 'Preguntas de evaluación',
    resumen: 'Preguntas con sus respuestas a partir del material.',
    construir: (c, t) =>
      `A partir del material de ${listaConceptos(c)} (usa leer_material), redacta preguntas de evaluación ` +
      `con sus respuestas.${fraseTemas(t)}${fraseGuardar(t)}`
  }
]

export function GrafoPage(): JSX.Element {
  const [grafo, setGrafo] = useState<GrafoDTO | null>(null)
  const [tipos, setTipos] = useState<Set<TipoAristaGrafo>>(() => new Set(TIPOS_ARISTA.map((t) => t.tipo)))
  const [mostrarTareas, setMostrarTareas] = useState(true)
  const [asignaturasFiltro, setAsignaturasFiltro] = useState<Set<string>>(new Set())
  const [tareasCombinar, setTareasCombinar] = useState<string[]>([])
  const [dialogoCombinar, setDialogoCombinar] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [modalId, setModalId] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<FichaConceptoDTO | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; texto: string } | null>(null)
  const [usosSel, setUsosSel] = useState<UsoDeConceptoDTO[]>([])
  const [modalPrompt, setModalPrompt] = useState(false)
  const [comando, setComando] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [alturaDrag, setAlturaDrag] = useState<number | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const columnaRef = useRef<HTMLDivElement>(null)

  const notificarError = useUiStore((s) => s.notificarError)
  const irASeccion = useUiStore((s) => s.irASeccion)
  const seleccionarConcepto = useUiStore((s) => s.seleccionarConcepto)
  const seleccionarAsignatura = useUiStore((s) => s.seleccionarAsignatura)
  const cargarConceptos = useConceptosStore((s) => s.cargar)
  const panelColapsado = useLayoutStore((s) => s.panelGrafoColapsado)
  const alternarPanel = useLayoutStore((s) => s.alternarPanelGrafo)
  const terminalAltura = useLayoutStore((s) => s.terminalAltura)
  const setTerminalAltura = useLayoutStore((s) => s.setTerminalAltura)
  const alternarTerminal = useLayoutStore((s) => s.alternarTerminal)
  const tema = useLayoutStore((s) => s.tema)

  useEffect(() => {
    api.obtenerGrafo().then(setGrafo).catch((e) => notificarError(e))
  }, [notificarError])

  const elementos = useMemo(
    () => (grafo ? elementosVisibles(grafo, tipos, mostrarTareas, asignaturasFiltro) : []),
    [grafo, tipos, mostrarTareas, asignaturasFiltro]
  )

  // Asignaturas disponibles (desde los nodos del grafo) para el filtro.
  const asignaturasGrafo = useMemo(
    () =>
      (grafo?.nodos ?? [])
        .filter((n) => n.tipo === 'asignatura')
        .map((n) => ({ id: n.id.slice(2), etiqueta: n.etiqueta }))
        .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es')),
    [grafo]
  )
  const alternarAsignaturaFiltro = (id: string): void =>
    setAsignaturasFiltro((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })

  const relacionados = useMemo(
    () =>
      grafo && seleccionado
        ? relacionadosDe(grafo, seleccionado).map((r, i) => ({ ...r, color: PALETA[i % PALETA.length] }))
        : [],
    [grafo, seleccionado]
  )
  const colorPorId = useMemo(() => new Map(relacionados.map((r) => [r.id, r.color])), [relacionados])

  // Crea el grafo cuando cambian los elementos (filtros de arista).
  useEffect(() => {
    if (!contenedor.current || elementos.length === 0) return
    const cy = cytoscape({
      container: contenedor.current,
      elements: elementos,
      style: ESTILO,
      layout: { name: 'fcose', animate: false, randomize: true, nodeSeparation: 90, idealEdgeLength: 95 } as cytoscape.LayoutOptions,
      minZoom: 0.2,
      maxZoom: 3
    })
    cyRef.current = cy
    window.__cy = cy

    cy.on('tap', 'node[tipo="concepto"]', (evt) => setSeleccionado(evt.target.id().slice(2)))
    cy.on('dbltap', 'node[tipo="concepto"]', (evt) => setModalId(evt.target.id().slice(2)))
    // Clic en una tarea: añádela/quítala de la selección para combinar.
    // Doble clic: ir a su asignatura para ver la ficha.
    cy.on('tap', 'node[tipo="tarea"]', (evt) => {
      const id = evt.target.id().slice(2)
      setTareasCombinar((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    })
    cy.on('dbltap', 'node[tipo="tarea"]', (evt) => {
      const aid = evt.target.data('asignaturaId') as string | undefined
      if (aid) {
        irASeccion('asignaturas')
        seleccionarAsignatura(aid)
      }
    })
    cy.on('mouseover', 'node', (evt) => {
      const p = evt.target.renderedPosition()
      setTooltip({ x: p.x, y: p.y, texto: String(evt.target.data('completa') ?? evt.target.data('etiqueta')) })
    })
    cy.on('mouseout', 'node', () => setTooltip(null))
    cy.on('pan zoom', () => setTooltip(null))

    // Mantiene el texto de las etiquetas a un tamaño de pantalla ~constante:
    // el tamaño en el modelo es inverso al zoom, así al acercarse no se agranda y
    // sigue legible con cientos de nodos. Se ocultan al alejarse mucho.
    const ajustarEtiquetas = (): void => {
      const z = cy.zoom()
      const tam = Math.min(Math.max(11 / z, 3), 40)
      cy.batch(() => {
        cy.nodes('[tipo="concepto"]').style({ 'font-size': tam, 'text-opacity': z < 0.4 ? 0 : 1 })
      })
    }
    cy.on('zoom', ajustarEtiquetas)
    ajustarEtiquetas()

    // Mantiene el lienzo sincronizado con el tamaño real del contenedor
    // (arregla el clic tras hacer zoom o al cambiar el layout).
    const ro = new ResizeObserver(() => cy.resize())
    ro.observe(contenedor.current)
    return () => {
      ro.disconnect()
      cy.destroy()
      cyRef.current = null
    }
  }, [elementos])

  // Resalta el vecindario del nodo seleccionado y colorea los relacionados.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes('[tipo="concepto"]').style('background-color', '#6366f1') // restablece
    cy.elements().removeClass('atenuado').removeClass('foco')
    if (!seleccionado) return
    const nodo = cy.getElementById(`c:${seleccionado}`)
    if (nodo.nonempty()) {
      cy.elements().addClass('atenuado')
      nodo.removeClass('atenuado').addClass('foco')
      nodo.neighborhood().removeClass('atenuado')
      for (const [id, color] of colorPorId) {
        cy.getElementById(`c:${id}`).style('background-color', color)
      }
    }
  }, [seleccionado, elementos, colorPorId])

  // Color de las etiquetas de los nodos según el tema (legible en claro y oscuro).
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes('[tipo="concepto"]').style('color', tema === 'oscuro' ? '#cbd5e1' : '#334155')
  }, [tema, elementos])

  // Resalta las tareas seleccionadas para combinar.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes('[tipo="tarea"]').removeClass('combinar')
    for (const id of tareasCombinar) cy.getElementById(`t:${id}`).addClass('combinar')
  }, [tareasCombinar, elementos])

  // Carga el detalle para la modal.
  useEffect(() => {
    if (!modalId) {
      setDetalle(null)
      return
    }
    setDetalle(null)
    api.obtenerFichaConcepto(modalId).then(setDetalle).catch((e) => notificarError(e))
  }, [modalId, notificarError])

  // Temas donde se usa el concepto seleccionado (contexto para los prompts de IA).
  useEffect(() => {
    if (!seleccionado) {
      setUsosSel([])
      return
    }
    api
      .obtenerFichaConcepto(seleccionado)
      .then((f) => setUsosSel(f.usos))
      .catch(() => setUsosSel([]))
  }, [seleccionado])

  const alternarTipo = (t: TipoAristaGrafo): void =>
    setTipos((prev) => {
      const s = new Set(prev)
      s.has(t) ? s.delete(t) : s.add(t)
      return s
    })

  // IDs de conceptos conectados al seleccionado (incluye el propio seleccionado).
  const idsConectados = useMemo(() => {
    if (!seleccionado) return null
    return new Set<string>([seleccionado, ...relacionados.map((r) => r.id)])
  }, [seleccionado, relacionados])

  // Conceptos realmente visibles en el grafo (respetan el filtro por asignatura).
  const idsConceptoVisibles = useMemo(
    () => new Set(elementos.filter((e) => e.data?.tipo === 'concepto').map((e) => e.data?.id as string)),
    [elementos]
  )

  const conceptos = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (grafo?.nodos ?? [])
      .filter((n): n is NodoGrafoDTO => {
        if (n.tipo !== 'concepto') return false
        if (!idsConceptoVisibles.has(n.id)) return false // respeta el filtro por asignatura
        // Con un nodo seleccionado, la lista se limita a sus nodos conectados.
        if (idsConectados && !idsConectados.has(n.id.slice(2))) return false
        return n.etiqueta.toLowerCase().includes(q)
      })
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
  }, [grafo, busqueda, idsConectados, idsConceptoVisibles])

  const nombreSel = grafo?.nodos.find((n) => n.id === `c:${seleccionado}`)?.etiqueta
  const vacio = grafo !== null && grafo.nodos.length === 0

  const temasSel = useMemo(() => [...new Set(usosSel.map((u) => u.tema))], [usosSel])
  const conceptosSel = useMemo(
    () => (nombreSel ? [nombreSel, ...relacionados.map((r) => r.etiqueta)] : []),
    [nombreSel, relacionados]
  )

  const alturaTerminal = alturaDrag ?? terminalAltura
  const terminalAbierta = alturaTerminal > 0

  const abrirPrompt = (): void => {
    if (!comando.trim()) setComando(PLANTILLAS[0].construir(conceptosSel, temasSel))
    setModalPrompt(true)
  }
  const copiarComando = (): void => {
    if (!comando.trim()) return
    void navigator.clipboard.writeText(comando)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }
  const insertarComando = (): void => {
    const txt = comando.trim()
    if (!txt) return
    const cerrada = terminalAltura === 0
    if (cerrada) alternarTerminal() // abre la terminal si estaba cerrada
    // Ctrl-U (\x15) limpia la línea actual del CLI antes de escribir, para que al
    // cambiar de nodos el nuevo prompt reemplace al anterior en vez de acumularse.
    const enviar = (): void => window.api.terminal.escribir('\x15' + txt)
    if (cerrada) setTimeout(enviar, 700)
    else enviar()
    setModalPrompt(false)
  }

  const iniciarResize = (e: ReactMouseEvent): void => {
    e.preventDefault()
    const startY = e.clientY
    const startH = terminalAltura
    const colH = columnaRef.current?.clientHeight ?? 600
    const maxH = Math.max(120, colH - 140)
    let ultima = startH
    const onMove = (ev: MouseEvent): void => {
      ultima = Math.min(Math.max(startH + (startY - ev.clientY), 0), maxH)
      setAlturaDrag(ultima)
    }
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setAlturaDrag(null)
      setTerminalAltura(ultima)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Tareas seleccionadas para combinar, con su título y asignatura (para el diálogo).
  const tareasOrigen = useMemo(() => {
    const porId = new Map(
      (grafo?.nodos ?? []).filter((n) => n.tipo === 'tarea').map((n) => [n.id.slice(2), n])
    )
    return tareasCombinar
      .map((id) => porId.get(id))
      .filter((n): n is NonNullable<typeof n> => !!n)
      .map((n) => ({ id: n.id.slice(2), titulo: n.etiqueta, asignaturaId: n.asignaturaId }))
  }, [grafo, tareasCombinar])

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 px-8 py-4">
        <h1 className="text-2xl font-semibold text-slate-900">Mapa de conceptos</h1>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {TIPOS_ARISTA.map((t) => (
            <button
              key={t.tipo}
              onClick={() => alternarTipo(t.tipo)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                tipos.has(t.tipo) ? 'border-slate-300 bg-white text-slate-700' : 'border-slate-200 bg-slate-50 text-slate-300'
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
              {t.etiqueta}
            </button>
          ))}
          <button
            onClick={() => setMostrarTareas((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
              mostrarTareas ? 'border-slate-300 bg-white text-slate-700' : 'border-slate-200 bg-slate-50 text-slate-300'
            }`}
          >
            <span className="h-2 w-2 rotate-45" style={{ backgroundColor: '#f59e0b' }} />
            Tareas
          </button>
        </div>

        {asignaturasGrafo.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-slate-400">Asignatura:</span>
            <button
              onClick={() => setAsignaturasFiltro(new Set())}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                asignaturasFiltro.size === 0
                  ? 'border-marca-300 bg-marca-50 text-marca-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Todas
            </button>
            {asignaturasGrafo.map((a) => (
              <button
                key={a.id}
                onClick={() => alternarAsignaturaFiltro(a.id)}
                title={a.etiqueta}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  asignaturasFiltro.has(a.id)
                    ? 'border-marca-300 bg-marca-50 text-marca-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {truncar(a.etiqueta, 26)}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Columna izquierda: grafo arriba + terminal redimensionable abajo.
            min-w-0 permite que se encoja por debajo del ancho del lienzo. */}
        <div ref={columnaRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Grafo */}
        <div className="relative min-h-0 flex-1">
          {vacio ? (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div>
                <div className="mb-2 text-3xl">🕸️</div>
                <p className="text-sm text-slate-500">
                  Aún no hay nada que mostrar. Crea conceptos y vincúlalos a temas de tus asignaturas.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div ref={contenedor} className="h-full w-full" />
              {tooltip && (
                <div
                  className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded bg-slate-800 px-2 py-1 text-xs text-white shadow"
                  style={{ left: tooltip.x, top: tooltip.y - 8 }}
                >
                  {tooltip.texto}
                </div>
              )}
              {/* Barra de combinación de tareas (aparece al seleccionar nodos-tarea). */}
              {mostrarTareas && tareasCombinar.length > 0 && (
                <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
                  <span className="text-xs text-slate-600">
                    {tareasCombinar.length} {tareasCombinar.length === 1 ? 'tarea' : 'tareas'}
                    {tareasCombinar.length < 2 && ' · elige otra para combinar'}
                  </span>
                  <button
                    onClick={() => setDialogoCombinar(true)}
                    disabled={tareasCombinar.length < 2}
                    className="rounded-md bg-marca-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-marca-500 disabled:opacity-40"
                  >
                    Combinar en una tarea nueva
                  </button>
                  <button
                    onClick={() => setTareasCombinar([])}
                    className="text-xs text-slate-400 hover:underline"
                  >
                    Limpiar
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Asa/cabecera de la terminal: siempre visible; se arrastra para
            redimensionar y su chevron abre/cierra. */}
        <div
          onMouseDown={iniciarResize}
          title="Arrastra para cambiar el alto de la terminal"
          className="flex shrink-0 cursor-ns-resize select-none items-center gap-2 border-t border-slate-700 bg-slate-800 px-3 py-1.5"
        >
          <span className="text-slate-500">⋯</span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={alternarTerminal}
            className="flex items-center gap-1 text-xs font-medium text-slate-200 transition hover:text-white"
          >
            <span>{terminalAbierta ? '⌄' : '⌃'}</span>⌨ Terminal IA
          </button>
          {nombreSel && (
            <span className="truncate text-[11px] text-slate-400">
              · {nombreSel}
              {relacionados.length > 0 && ` +${relacionados.length}`}
            </span>
          )}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={abrirPrompt}
            className="ml-auto rounded bg-marca-600 px-2 py-0.5 text-xs font-medium text-white transition hover:bg-marca-500"
          >
            💡 Prompts
          </button>
        </div>

        {/* Contenido de la terminal (xterm), con la altura elegida */}
        {terminalAbierta && (
          <div style={{ height: alturaTerminal }} className="shrink-0 overflow-hidden bg-slate-900">
            <TerminalEmbebida className="h-full w-full p-2" />
          </div>
        )}
        </div>

        {/* Panel derecho: colapsado (franja de puntos de color) o expandido (lista) */}
        {panelColapsado ? (
          <aside className="flex w-12 shrink-0 flex-col items-center border-l border-slate-200 bg-white py-3">
            <button
              onClick={alternarPanel}
              title="Expandir el panel de conceptos"
              className="mb-3 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              «
            </button>
            <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto">
              {conceptos.map((c) => {
                const id = c.id.slice(2)
                const activo = id === seleccionado
                const color = colorPorId.get(id)
                return (
                  <button
                    key={c.id}
                    onClick={() => setSeleccionado(id)}
                    onDoubleClick={() => setModalId(id)}
                    title={c.etiqueta}
                    className="h-3.5 w-3.5 shrink-0 rounded-full transition"
                    style={{
                      backgroundColor: activo ? '#4338ca' : (color ?? '#cbd5e1'),
                      outline: activo ? '2px solid #4338ca' : undefined,
                      outlineOffset: 2
                    }}
                  />
                )
              })}
            </div>
          </aside>
        ) : (
        <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 p-4">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar concepto…"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
            />
            <button
              onClick={alternarPanel}
              title="Contraer el panel"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              »
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {seleccionado ? `Conectados (${conceptos.length})` : `Conceptos (${conceptos.length})`}
              </p>
              {seleccionado && (
                <button
                  onClick={() => setSeleccionado(null)}
                  className="text-xs text-marca-600 hover:underline"
                >
                  Ver todos
                </button>
              )}
            </div>
            <ul className="space-y-0.5">
              {conceptos.map((c) => {
                const id = c.id.slice(2)
                const activo = id === seleccionado
                const color = colorPorId.get(id)
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSeleccionado(id)}
                      onDoubleClick={() => setModalId(id)}
                      title={c.etiqueta}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                        activo ? 'bg-marca-50 text-marca-700' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: activo ? '#4338ca' : (color ?? '#e2e8f0') }}
                      />
                      <span className="min-w-0 flex-1 truncate">{c.etiqueta}</span>
                      {c.peso > 0 && <span className="shrink-0 text-xs text-slate-400">{c.peso}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>

            {seleccionado && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-2 px-1 text-xs text-slate-400">
                  {relacionados.length === 0
                    ? 'Este concepto aún no tiene conexiones.'
                    : `Mostrando «${nombreSel}» y sus ${relacionados.length} conexiones. Doble clic abre el detalle.`}
                </p>
                <Boton variante="secundario" className="w-full" onClick={() => setModalId(seleccionado)}>
                  Ver descripción y datos
                </Boton>
              </div>
            )}
          </div>
        </aside>
        )}
      </div>

      {/* Modal de detalle del concepto */}
      {modalId && (
        <Modal titulo={detalle?.concepto.nombre ?? 'Cargando…'} ancho="lg" onCerrar={() => setModalId(null)}>
          {detalle ? (
            <div className="space-y-5 text-sm">
              {detalle.concepto.descripcion && <p className="text-slate-600">{detalle.concepto.descripcion}</p>}
              <p className="text-xs text-slate-400">
                {detalle.concepto.recursos.length === 0
                  ? 'Sin material'
                  : `${detalle.concepto.recursos.length} ${detalle.concepto.recursos.length === 1 ? 'material' : 'materiales'}`}
              </p>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Se usa en</h3>
                {detalle.usos.length === 0 ? (
                  <p className="text-xs text-slate-400">No se usa en ninguna asignatura.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detalle.usos.map((u) => (
                      <li key={`${u.asignaturaId}-${u.temaId}`} className="text-xs text-slate-600">
                        <span className="font-medium">{u.asignatura} · {u.periodos.join(', ')}</span>
                        <span className="text-slate-400"> › {u.unidad} › {u.tema}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Conceptos relacionados</h3>
                {relacionadosDe(grafo as GrafoDTO, modalId).length === 0 ? (
                  <p className="text-xs text-slate-400">Sin conexiones todavía.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {relacionadosDe(grafo as GrafoDTO, modalId).map((r) => (
                      <li key={r.id}>
                        <button
                          onClick={() => setModalId(r.id)}
                          className="rounded-full bg-marca-50 px-2.5 py-1 text-xs text-marca-700 hover:bg-marca-100"
                        >
                          {r.etiqueta}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="flex justify-end">
                <Boton
                  variante="primario"
                  onClick={() => {
                    irASeccion('conceptos')
                    void cargarConceptos()
                    seleccionarConcepto(detalle.concepto.id)
                  }}
                >
                  Abrir ficha completa
                </Boton>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Cargando…</p>
          )}
        </Modal>
      )}

      {/* Diálogo para combinar las tareas seleccionadas en una nueva */}
      {dialogoCombinar && tareasOrigen.length >= 2 && (
        <CombinarTareasDialog
          origen={tareasOrigen.map((t) => ({ id: t.id, titulo: t.titulo }))}
          asignaturaSugerida={tareasOrigen[0]?.asignaturaId}
          onCerrar={() => setDialogoCombinar(false)}
          onCombinada={(nueva) => {
            setDialogoCombinar(false)
            setTareasCombinar([])
            irASeccion('asignaturas')
            seleccionarAsignatura(nueva.asignaturaId)
          }}
        />
      )}

      {/* Modal para componer el prompt de la IA a partir de la selección */}
      {modalPrompt && (
        <Modal titulo="Prompts para la IA" ancho="lg" onCerrar={() => setModalPrompt(false)}>
          <div className="space-y-4 text-sm">
            <p className="text-xs text-slate-500">
              {conceptosSel.length > 0 ? (
                <>
                  Contexto: <span className="font-medium text-slate-700">{conceptosSel.join(', ')}</span>
                  {temasSel.length > 0 && <> · Temas: {temasSel.join(', ')}</>}
                </>
              ) : (
                'Selecciona un concepto en el mapa para enlazar sus temas relacionados, o escribe tu propio prompt.'
              )}
            </p>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Ejemplos (haz clic para usar)
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PLANTILLAS.map((p) => (
                  <button
                    key={p.clave}
                    onClick={() => setComando(p.construir(conceptosSel, temasSel))}
                    className="rounded-lg border border-slate-200 p-3 text-left transition hover:border-marca-300 hover:bg-marca-50"
                  >
                    <p className="font-medium text-slate-800">{p.titulo}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{p.resumen}</p>
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={comando}
              onChange={(e) => setComando(e.target.value)}
              rows={5}
              placeholder="Escribe tu prompt o elige un ejemplo…"
              className="w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
            />

            <div className="flex items-center justify-between">
              <button onClick={() => setComando('')} className="text-xs text-slate-500 hover:underline">
                Limpiar
              </button>
              <div className="flex gap-2">
                <Boton variante="secundario" onClick={copiarComando}>
                  {copiado ? '✓ Copiado' : 'Copiar'}
                </Boton>
                <Boton variante="primario" onClick={insertarComando} disabled={!comando.trim()}>
                  Insertar en la terminal
                </Boton>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Cada plantilla le pide a la IA guardar el resultado como tarea en PedagoGraph
              (herramienta «crear_tarea»), así aparece en la asignatura y puedes reutilizarla.
              «Insertar» pega el prompt en la terminal; revísalo y pulsa Enter.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
