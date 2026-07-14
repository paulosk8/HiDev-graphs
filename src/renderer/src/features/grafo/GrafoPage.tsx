import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import {
  type FichaConceptoDTO,
  type GrafoDTO,
  type NodoGrafoDTO,
  type TipoAristaGrafo,
  type TipoRelacion,
  type UsoDeConceptoDTO
} from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { Modal } from '../../components/Modal'
import { TerminalEmbebida } from '../terminal/TerminalEmbebida'
import { CombinarTareasDialog } from '../tareas/CombinarTareasDialog'
import { api } from '../../lib/api'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore, type Contexto } from '../../stores/uiStore'
import { useLayoutStore } from '../../stores/layoutStore'

cytoscape.use(fcose)

type EstiloLinea = 'solid' | 'dashed' | 'dotted'
interface TipoArista {
  tipo: TipoAristaGrafo
  etiqueta: string
  color: string
  estilo: EstiloLinea
  /** true si la línea lleva flecha (relación con dirección/orden). */
  flecha: boolean
  ayuda: string
}

const TIPOS_ARISTA: TipoArista[] = [
  {
    tipo: 'usado_en',
    etiqueta: 'Se usa en la asignatura',
    color: '#94a3b8',
    estilo: 'solid',
    flecha: false,
    ayuda: 'El concepto forma parte de esa asignatura.'
  },
  {
    tipo: 'prerequisito_de',
    etiqueta: 'Se aprende antes',
    color: '#ef4444',
    estilo: 'solid',
    flecha: true,
    ayuda: 'Conviene dominar un concepto antes que el otro (la flecha marca el orden).'
  },
  {
    tipo: 'profundiza',
    etiqueta: 'Profundiza en',
    color: '#10b981',
    estilo: 'solid',
    flecha: true,
    ayuda: 'Un concepto amplía o profundiza en el otro (la flecha marca hacia dónde).'
  },
  {
    tipo: 'relacionado_con',
    etiqueta: 'Relacionado',
    color: '#64748b',
    estilo: 'solid',
    flecha: false,
    ayuda: 'Conceptos vinculados, sin un orden ni jerarquía.'
  },
  {
    tipo: 'coocurre',
    etiqueta: 'Se enseñan juntos',
    color: '#818cf8',
    estilo: 'dashed',
    flecha: false,
    ayuda: 'Aparecen en el mismo tema (relación sugerida por la app).'
  }
]

const COLOR_TAREA = '#f59e0b'

/** Muestra visual de una línea del grafo (color, estilo y flecha). */
function MuestraLinea({
  color,
  estilo,
  flecha
}: {
  color: string
  estilo: EstiloLinea
  flecha: boolean
}): JSX.Element {
  const dash = estilo === 'dashed' ? '5,3' : estilo === 'dotted' ? '1.5,3' : undefined
  return (
    <svg width="32" height="12" viewBox="0 0 32 12" aria-hidden className="shrink-0">
      <line
        x1="2"
        y1="6"
        x2={flecha ? 23 : 30}
        y2="6"
        stroke={color}
        strokeWidth="2.2"
        strokeDasharray={dash}
        strokeLinecap="round"
      />
      {flecha && <path d="M23 1.5 L30 6 L23 10.5 Z" fill={color} />}
    </svg>
  )
}
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
  { selector: 'edge', style: { 'curve-style': 'bezier', width: 1.5, 'line-color': '#94a3b8' } },
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
  asignaturasPermitidas: Set<string>
): cytoscape.ElementDefinition[] {
  // El mapa está siempre acotado al contexto activo (docencia/aprendizaje): solo
  // se muestran las asignaturas permitidas y los conceptos/tareas ligados a ellas.
  // Conceptos usados en las asignaturas permitidas (vía aristas 'usado_en').
  const conceptosPermitidos = new Set<string>()
  for (const a of grafo.aristas) {
    if (a.tipo === 'usado_en' && a.asignaturaId && asignaturasPermitidas.has(a.asignaturaId)) {
      conceptosPermitidos.add(a.origen)
    }
  }
  const nodoVisible = (n: NodoGrafoDTO): boolean => {
    if (n.tipo === 'tarea' && !mostrarTareas) return false
    if (n.tipo === 'asignatura') return asignaturasPermitidas.has(n.id.slice(2))
    if (n.tipo === 'concepto') return conceptosPermitidos.has(n.id)
    if (n.tipo === 'tarea') return !!n.asignaturaId && asignaturasPermitidas.has(n.asignaturaId)
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

/**
 * Análisis de conexiones estructural (sin IA), calculado desde el grafo:
 *  - `posibles`: pares de conceptos que co-ocurren (se enseñan juntos) pero no
 *    tienen una relación tipada entre sí. Candidatos a vincular.
 *  - `aislados`: conceptos sin ninguna conexión con otros conceptos.
 */
function sugerenciasDeConexion(grafo: GrafoDTO): {
  posibles: { a: string; b: string; nombreA: string; nombreB: string }[]
  aislados: { id: string; nombre: string }[]
} {
  const conceptos = grafo.nodos.filter((n) => n.tipo === 'concepto')
  const nombreDe = new Map(conceptos.map((n) => [n.id, n.etiqueta]))
  const clave = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)
  const tipadas = new Set<string>()
  const coocurre = new Set<string>()
  const conVinculo = new Set<string>()
  for (const ar of grafo.aristas) {
    if (!ar.origen.startsWith('c:') || !ar.destino.startsWith('c:')) continue
    const k = clave(ar.origen, ar.destino)
    if (ar.tipo === 'coocurre') coocurre.add(k)
    else if (ar.tipo === 'prerequisito_de' || ar.tipo === 'relacionado_con' || ar.tipo === 'profundiza') tipadas.add(k)
    else continue
    conVinculo.add(ar.origen)
    conVinculo.add(ar.destino)
  }
  const posibles = [...coocurre]
    .filter((k) => !tipadas.has(k))
    .map((k) => {
      const [a, b] = k.split('|')
      return { a, b, nombreA: nombreDe.get(a) ?? a, nombreB: nombreDe.get(b) ?? b }
    })
  const aislados = conceptos.filter((n) => !conVinculo.has(n.id)).map((n) => ({ id: n.id, nombre: n.etiqueta }))
  return { posibles, aislados }
}

interface Props {
  contexto: Contexto
}

export function GrafoPage({ contexto }: Props): JSX.Element {
  const [grafo, setGrafo] = useState<GrafoDTO | null>(null)
  const [tipos, setTipos] = useState<Set<TipoAristaGrafo>>(() => new Set(TIPOS_ARISTA.map((t) => t.tipo)))
  const [mostrarTareas, setMostrarTareas] = useState(true)
  const [leyendaColapsada, setLeyendaColapsada] = useState(false)
  const [asignaturasFiltro, setAsignaturasFiltro] = useState<Set<string>>(new Set())
  const [filtroAsigAbierto, setFiltroAsigAbierto] = useState(false)
  const [busquedaAsig, setBusquedaAsig] = useState('')
  const [tareasCombinar, setTareasCombinar] = useState<string[]>([])
  const [dialogoCombinar, setDialogoCombinar] = useState(false)
  const [modalAnalisis, setModalAnalisis] = useState(false)
  const [vinculando, setVinculando] = useState<string | null>(null)
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

  const asignaturasLista = useAsignaturasStore((s) => s.lista)
  // Ids de las asignaturas de ESTE contexto (docencia/aprendizaje): acotan el mapa.
  const idsDelContexto = useMemo(
    () =>
      new Set(
        asignaturasLista
          .filter((a) => (contexto === 'aprendizaje' ? a.tipo === 'aprendizaje' : a.tipo !== 'aprendizaje'))
          .map((a) => a.id)
      ),
    [asignaturasLista, contexto]
  )

  const notificarError = useUiStore((s) => s.notificarError)
  const notificar = useUiStore((s) => s.notificar)
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

  const recargarGrafo = useCallback(() => {
    api.obtenerGrafo().then(setGrafo).catch((e) => notificarError(e))
  }, [notificarError])

  useEffect(() => {
    recargarGrafo()
  }, [recargarGrafo])

  // Refresca el grafo cuando el vault cambia (p. ej. la IA crea una tarea desde
  // la terminal): así el nuevo nodo aparece sin recargar la app.
  useEffect(() => api.onVaultCambiado(recargarGrafo), [recargarGrafo])

  // Conjunto efectivo de asignaturas permitidas: las del contexto, intersecadas
  // con el filtro por asignatura si el usuario eligió alguna.
  const asignaturasPermitidas = useMemo(() => {
    if (asignaturasFiltro.size === 0) return idsDelContexto
    return new Set([...asignaturasFiltro].filter((id) => idsDelContexto.has(id)))
  }, [asignaturasFiltro, idsDelContexto])

  const elementos = useMemo(
    () => (grafo ? elementosVisibles(grafo, tipos, mostrarTareas, asignaturasPermitidas) : []),
    [grafo, tipos, mostrarTareas, asignaturasPermitidas]
  )

  // Asignaturas del contexto disponibles (desde los nodos del grafo) para el filtro.
  const asignaturasGrafo = useMemo(
    () =>
      (grafo?.nodos ?? [])
        .filter((n) => n.tipo === 'asignatura' && idsDelContexto.has(n.id.slice(2)))
        .map((n) => ({ id: n.id.slice(2), etiqueta: n.etiqueta }))
        .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es')),
    [grafo, idsDelContexto]
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
        irASeccion('asignaturas', contexto)
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

  // Análisis de conexiones (estructural, desde el grafo).
  const analisis = useMemo(
    () => (grafo ? sugerenciasDeConexion(grafo) : { posibles: [], aislados: [] }),
    [grafo]
  )
  const vincularPar = async (origen: string, destino: string, tipo: TipoRelacion): Promise<void> => {
    const key = `${origen}|${destino}`
    setVinculando(key)
    try {
      await api.vincularConceptos(origen.slice(2), destino.slice(2), tipo)
      setGrafo(await api.obtenerGrafo()) // refresca para que aparezca la nueva arista
      notificar({ tipo: 'exito', mensaje: 'Conceptos vinculados.' })
    } catch (error) {
      notificarError(error)
    } finally {
      setVinculando(null)
    }
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">
            Mapa de conceptos{' '}
            <span className="text-base font-normal text-slate-400">
              · {contexto === 'aprendizaje' ? 'Aprendizaje' : 'Docencia'}
            </span>
          </h1>
          <button
            onClick={() => setModalAnalisis(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            🔎 Analizar conexiones
            {analisis.posibles.length + analisis.aislados.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 text-xs font-medium text-amber-800">
                {analisis.posibles.length + analisis.aislados.length}
              </span>
            )}
          </button>
        </div>
        {asignaturasGrafo.length > 0 && asignaturasGrafo.length <= 6 && (
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

        {/* Muchas asignaturas: desplegable con búsqueda (multi-selección). */}
        {asignaturasGrafo.length > 6 && (
          <div className="relative mt-2 inline-flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Asignatura:</span>
            <button
              onClick={() => setFiltroAsigAbierto((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
            >
              {asignaturasFiltro.size === 0
                ? 'Todas'
                : asignaturasFiltro.size === 1
                  ? truncar(asignaturasGrafo.find((a) => asignaturasFiltro.has(a.id))?.etiqueta ?? '', 22)
                  : `${asignaturasFiltro.size} seleccionadas`}
              <span className="text-slate-400">▾</span>
            </button>
            {asignaturasFiltro.size > 0 && (
              <button onClick={() => setAsignaturasFiltro(new Set())} className="text-xs text-marca-600 hover:underline">
                Limpiar
              </button>
            )}
            {filtroAsigAbierto && (
              <>
                <button
                  aria-hidden
                  onClick={() => setFiltroAsigAbierto(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div className="absolute left-16 top-7 z-20 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                  <input
                    value={busquedaAsig}
                    onChange={(e) => setBusquedaAsig(e.target.value)}
                    placeholder="Buscar asignatura…"
                    className="mb-2 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
                  />
                  <div className="max-h-64 space-y-0.5 overflow-y-auto">
                    {asignaturasGrafo
                      .filter((a) => a.etiqueta.toLowerCase().includes(busquedaAsig.trim().toLowerCase()))
                      .map((a) => (
                        <label
                          key={a.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={asignaturasFiltro.has(a.id)}
                            onChange={() => alternarAsignaturaFiltro(a.id)}
                          />
                          <span className="truncate">{a.etiqueta}</span>
                        </label>
                      ))}
                  </div>
                </div>
              </>
            )}
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

              {/* Leyenda-filtro: qué significa cada línea; clic para mostrar/ocultar. */}
              <div className="absolute bottom-3 right-3 z-20 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
                <button
                  onClick={() => setLeyendaColapsada((v) => !v)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  <span>Tipos de conexión</span>
                  <span className="text-slate-400">{leyendaColapsada ? '▸' : '▾'}</span>
                </button>
                {!leyendaColapsada && (
                  <ul className="border-t border-slate-100 p-1.5">
                    {TIPOS_ARISTA.map((t) => (
                      <li key={t.tipo}>
                        <button
                          onClick={() => alternarTipo(t.tipo)}
                          title="Clic para mostrar u ocultar este tipo de línea"
                          className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-slate-50 ${
                            tipos.has(t.tipo) ? '' : 'opacity-40'
                          }`}
                        >
                          <span className="mt-0.5">
                            <MuestraLinea color={t.color} estilo={t.estilo} flecha={t.flecha} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-medium text-slate-700">{t.etiqueta}</span>
                            <span className="block text-[11px] leading-snug text-slate-400">{t.ayuda}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        onClick={() => setMostrarTareas((v) => !v)}
                        title="Clic para mostrar u ocultar las tareas"
                        className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-slate-50 ${
                          mostrarTareas ? '' : 'opacity-40'
                        }`}
                      >
                        <span className="mt-0.5">
                          <MuestraLinea color={COLOR_TAREA} estilo="dotted" flecha={false} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-slate-700">Tareas</span>
                          <span className="block text-[11px] leading-snug text-slate-400">
                            Une una tarea con los conceptos que cubre.
                          </span>
                        </span>
                      </button>
                    </li>
                  </ul>
                )}
              </div>

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
                    irASeccion('conceptos', contexto)
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
            irASeccion('asignaturas', contexto)
            seleccionarAsignatura(nueva.asignaturaId)
          }}
        />
      )}

      {/* Modal de análisis de conexiones (estructural, sin IA) */}
      {modalAnalisis && (
        <Modal titulo="Analizar conexiones" ancho="lg" onCerrar={() => setModalAnalisis(false)}>
          <div className="space-y-5 text-sm">
            {analisis.posibles.length === 0 && analisis.aislados.length === 0 ? (
              <p className="py-6 text-center text-slate-500">Tu grafo está bien conectado 🎉</p>
            ) : (
              <>
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Podrían estar relacionados ({analisis.posibles.length})
                  </h3>
                  {analisis.posibles.length === 0 ? (
                    <p className="text-xs text-slate-400">Nada que sugerir por co-ocurrencia.</p>
                  ) : (
                    <ul className="space-y-2">
                      {analisis.posibles.map((p) => {
                        const key = `${p.a}|${p.b}`
                        return (
                          <li key={key} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                            <span className="min-w-0 flex-1 text-slate-700">
                              <span className="font-medium">«{p.nombreA}»</span> y{' '}
                              <span className="font-medium">«{p.nombreB}»</span> se enseñan juntos pero no
                              están vinculados.
                            </span>
                            <button
                              onClick={() => void vincularPar(p.a, p.b, 'relacionado_con')}
                              disabled={vinculando !== null}
                              className="shrink-0 rounded-md bg-marca-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-marca-500 disabled:opacity-40"
                            >
                              {vinculando === key ? 'Vinculando…' : 'Vincular'}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>

                {analisis.aislados.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Sin conexiones ({analisis.aislados.length})
                    </h3>
                    <p className="mb-2 text-xs text-slate-400">
                      Estos conceptos no se conectan con otros. Enlázalos a un tema junto a otros conceptos,
                      o pídele a la IA que los analice.
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {analisis.aislados.map((c) => (
                        <li key={c.id}>
                          <button
                            onClick={() => setModalId(c.id)}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200"
                          >
                            {c.nombre}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <p className="text-[11px] text-slate-400">
                  Este análisis es estructural (co-ocurrencias). Para conexiones semánticas más finas, pide a
                  la IA: «analiza mis conexiones y sugiere las que falten».
                </p>
              </>
            )}
          </div>
        </Modal>
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
