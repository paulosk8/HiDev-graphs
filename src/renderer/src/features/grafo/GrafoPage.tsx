import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import {
  ETIQUETAS_RELACION,
  type GrafoDTO,
  type TipoAristaGrafo
} from '@shared/dtos'
import { api } from '../../lib/api'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'

cytoscape.use(fcose)

const TIPOS_ARISTA: { tipo: TipoAristaGrafo; etiqueta: string; color: string }[] = [
  { tipo: 'usado_en', etiqueta: 'Usado en', color: '#94a3b8' },
  { tipo: 'prerequisito_de', etiqueta: ETIQUETAS_RELACION.prerequisito_de, color: '#ef4444' },
  { tipo: 'relacionado_con', etiqueta: ETIQUETAS_RELACION.relacionado_con, color: '#64748b' },
  { tipo: 'profundiza', etiqueta: ETIQUETAS_RELACION.profundiza, color: '#10b981' }
]

const ESTILO: cytoscape.StylesheetStyle[] = [
  {
    selector: 'node',
    style: {
      label: 'data(etiqueta)',
      'font-size': 10,
      color: '#334155',
      'text-valign': 'bottom',
      'text-margin-y': 4,
      'text-wrap': 'wrap',
      'text-max-width': '90px'
    }
  },
  {
    selector: 'node[tipo="concepto"]',
    style: { 'background-color': '#6366f1', shape: 'ellipse', width: 'data(tam)', height: 'data(tam)' }
  },
  {
    selector: 'node[tipo="asignatura"]',
    style: {
      'background-color': '#e2e8f0',
      'border-color': '#64748b',
      'border-width': 1.5,
      shape: 'round-rectangle',
      width: 'label',
      height: 24,
      padding: '6px',
      color: '#0f172a',
      'font-weight': 'bold',
      'text-valign': 'center',
      'text-margin-y': 0
    }
  },
  { selector: 'edge', style: { 'curve-style': 'bezier', width: 1.5, 'line-color': '#cbd5e1' } },
  { selector: 'edge[tipo="prerequisito_de"]', style: { 'line-color': '#ef4444', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#ef4444' } },
  { selector: 'edge[tipo="relacionado_con"]', style: { 'line-color': '#94a3b8' } },
  { selector: 'edge[tipo="profundiza"]', style: { 'line-color': '#10b981', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#10b981' } }
]

function elementosVisibles(
  grafo: GrafoDTO,
  asignaturaFiltro: string,
  tipos: Set<TipoAristaGrafo>
): cytoscape.ElementDefinition[] {
  let nodos = grafo.nodos
  let aristas = grafo.aristas.filter((a) => tipos.has(a.tipo))

  if (asignaturaFiltro) {
    const aId = `a:${asignaturaFiltro}`
    const conceptos = new Set(
      grafo.aristas.filter((a) => a.tipo === 'usado_en' && a.destino === aId).map((a) => a.origen)
    )
    nodos = grafo.nodos.filter((n) => n.id === aId || conceptos.has(n.id))
    const visibles = new Set(nodos.map((n) => n.id))
    aristas = aristas.filter((a) => visibles.has(a.origen) && visibles.has(a.destino))
  }

  return [
    ...nodos.map((n) => ({
      data: {
        id: n.id,
        etiqueta: n.etiqueta,
        tipo: n.tipo,
        tam: n.tipo === 'concepto' ? Math.min(24 + n.peso * 8, 64) : 30
      }
    })),
    ...aristas.map((a) => ({
      data: { id: `${a.origen}__${a.destino}__${a.tipo}`, source: a.origen, target: a.destino, tipo: a.tipo }
    }))
  ]
}

export function GrafoPage(): JSX.Element {
  const [grafo, setGrafo] = useState<GrafoDTO | null>(null)
  const [asignaturaFiltro, setAsignaturaFiltro] = useState('')
  const [tipos, setTipos] = useState<Set<TipoAristaGrafo>>(
    () => new Set(TIPOS_ARISTA.map((t) => t.tipo))
  )
  const contenedor = useRef<HTMLDivElement>(null)

  const asignaturas = useAsignaturasStore((s) => s.lista)
  const notificarError = useUiStore((s) => s.notificarError)
  const irASeccion = useUiStore((s) => s.irASeccion)
  const seleccionarConcepto = useUiStore((s) => s.seleccionarConcepto)
  const cargarConceptos = useConceptosStore((s) => s.cargar)

  useEffect(() => {
    api.obtenerGrafo().then(setGrafo).catch((e) => notificarError(e))
  }, [notificarError])

  const elementos = useMemo(
    () => (grafo ? elementosVisibles(grafo, asignaturaFiltro, tipos) : []),
    [grafo, asignaturaFiltro, tipos]
  )

  useEffect(() => {
    if (!contenedor.current || elementos.length === 0) return
    const cy = cytoscape({
      container: contenedor.current,
      elements: elementos,
      style: ESTILO,
      layout: { name: 'fcose', animate: false, randomize: true, nodeSeparation: 90, idealEdgeLength: 90 } as cytoscape.LayoutOptions,
      minZoom: 0.2,
      maxZoom: 2.5
    })
    cy.on('tap', 'node[tipo="concepto"]', (evt) => {
      const id = evt.target.id().slice(2) // quita el prefijo 'c:'
      irASeccion('conceptos')
      void cargarConceptos()
      seleccionarConcepto(id)
    })
    return () => cy.destroy()
  }, [elementos, irASeccion, seleccionarConcepto, cargarConceptos])

  const alternarTipo = (t: TipoAristaGrafo): void =>
    setTipos((prev) => {
      const s = new Set(prev)
      s.has(t) ? s.delete(t) : s.add(t)
      return s
    })

  const vacio = grafo !== null && grafo.nodos.length === 0

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 px-8 py-5">
        <h1 className="text-2xl font-semibold text-slate-900">Mapa de conceptos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cómo se conectan tus conceptos y en qué asignaturas se reutilizan.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Asignatura:</span>
            <select
              value={asignaturaFiltro}
              onChange={(e) => setAsignaturaFiltro(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-marca-500"
            >
              <option value="">Todas</option>
              {asignaturas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} · {a.periodos.join(', ')}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            {TIPOS_ARISTA.map((t) => (
              <button
                key={t.tipo}
                onClick={() => alternarTipo(t.tipo)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                  tipos.has(t.tipo)
                    ? 'border-slate-300 bg-white text-slate-700'
                    : 'border-slate-200 bg-slate-50 text-slate-300'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                {t.etiqueta}
              </button>
            ))}
          </div>
        </div>
      </header>

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
            <div className="pointer-events-none absolute bottom-4 left-4 flex gap-4 rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-500 shadow-sm">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-marca-600" /> Concepto
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border border-slate-500 bg-slate-200" /> Asignatura
              </span>
              <span className="text-slate-400">Toca un concepto para abrir su ficha</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
