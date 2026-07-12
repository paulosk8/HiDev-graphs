import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import {
  ETIQUETAS_RELACION,
  type FichaConceptoDTO,
  type GrafoDTO,
  type TipoAristaGrafo
} from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { api } from '../../lib/api'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'

cytoscape.use(fcose)

const TIPOS_ARISTA: { tipo: TipoAristaGrafo; etiqueta: string; color: string }[] = [
  { tipo: 'coocurre', etiqueta: 'Se enseñan juntos', color: '#818cf8' },
  { tipo: 'usado_en', etiqueta: 'Usado en', color: '#cbd5e1' },
  { tipo: 'prerequisito_de', etiqueta: ETIQUETAS_RELACION.prerequisito_de, color: '#ef4444' },
  { tipo: 'relacionado_con', etiqueta: ETIQUETAS_RELACION.relacionado_con, color: '#64748b' },
  { tipo: 'profundiza', etiqueta: ETIQUETAS_RELACION.profundiza, color: '#10b981' }
]

const ETIQUETA_ARISTA: Record<string, string> = Object.fromEntries(
  TIPOS_ARISTA.map((t) => [t.tipo, t.etiqueta])
)

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
  { selector: 'edge[tipo="coocurre"]', style: { 'line-color': '#818cf8', 'line-style': 'dashed' } },
  { selector: 'edge[tipo="prerequisito_de"]', style: { 'line-color': '#ef4444', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#ef4444' } },
  { selector: 'edge[tipo="relacionado_con"]', style: { 'line-color': '#64748b' } },
  { selector: 'edge[tipo="profundiza"]', style: { 'line-color': '#10b981', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#10b981' } },
  { selector: '.atenuado', style: { opacity: 0.12 } },
  { selector: 'node.foco', style: { 'border-width': 3, 'border-color': '#4338ca' } }
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

/** Conceptos conectados a `conceptoId` en el grafo (con la relación que los une). */
function relacionadosDe(grafo: GrafoDTO, conceptoId: string): { id: string; etiqueta: string; via: string }[] {
  const yo = `c:${conceptoId}`
  const etiquetaDe = new Map(grafo.nodos.map((n) => [n.id, n.etiqueta]))
  const vistos = new Map<string, { id: string; etiqueta: string; via: string }>()
  for (const a of grafo.aristas) {
    let otro: string | null = null
    if (a.origen === yo && a.destino.startsWith('c:')) otro = a.destino
    else if (a.destino === yo && a.origen.startsWith('c:')) otro = a.origen
    if (!otro || vistos.has(otro)) continue
    vistos.set(otro, {
      id: otro.slice(2),
      etiqueta: etiquetaDe.get(otro) ?? otro.slice(2),
      via: ETIQUETA_ARISTA[a.tipo] ?? a.tipo
    })
  }
  return [...vistos.values()]
}

export function GrafoPage(): JSX.Element {
  const [grafo, setGrafo] = useState<GrafoDTO | null>(null)
  const [asignaturaFiltro, setAsignaturaFiltro] = useState('')
  const [tipos, setTipos] = useState<Set<TipoAristaGrafo>>(
    () => new Set(TIPOS_ARISTA.map((t) => t.tipo))
  )
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<FichaConceptoDTO | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)

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

  // Crea el grafo cuando cambian los elementos (filtros).
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
    cyRef.current = cy
    window.__cy = cy // handle de depuración
    cy.on('tap', 'node[tipo="concepto"]', (evt) => setSeleccionado(evt.target.id().slice(2)))
    cy.on('tap', (evt) => {
      if (evt.target === cy) setSeleccionado(null) // clic en el fondo deselecciona
    })
    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [elementos])

  // Carga el detalle y resalta el vecindario al seleccionar.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().removeClass('atenuado').removeClass('foco')
    if (!seleccionado) {
      setDetalle(null)
      return
    }
    setDetalle(null)
    api.obtenerFichaConcepto(seleccionado).then(setDetalle).catch((e) => notificarError(e))

    const nodo = cy.getElementById(`c:${seleccionado}`)
    if (nodo.nonempty()) {
      cy.elements().addClass('atenuado')
      nodo.removeClass('atenuado').addClass('foco')
      nodo.neighborhood().removeClass('atenuado')
      cy.animate({ center: { eles: nodo }, duration: 250 })
    }
    cy.resize()
  }, [seleccionado, elementos, notificarError])

  const alternarTipo = (t: TipoAristaGrafo): void =>
    setTipos((prev) => {
      const s = new Set(prev)
      s.has(t) ? s.delete(t) : s.add(t)
      return s
    })

  const abrirFicha = (id: string): void => {
    irASeccion('conceptos')
    void cargarConceptos()
    seleccionarConcepto(id)
  }

  const vacio = grafo !== null && grafo.nodos.length === 0
  const relacionados = grafo && seleccionado ? relacionadosDe(grafo, seleccionado) : []

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

      <div className="flex min-h-0 flex-1">
        {/* Panel lateral izquierdo */}
        {seleccionado && (
          <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-start justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {detalle?.concepto.nombre ?? 'Cargando…'}
              </h2>
              <button
                onClick={() => setSeleccionado(null)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            {detalle && (
              <div className="space-y-5 text-sm">
                {detalle.concepto.descripcion && (
                  <p className="text-slate-600">{detalle.concepto.descripcion}</p>
                )}
                <p className="text-xs text-slate-400">
                  {detalle.concepto.recursos.length === 0
                    ? 'Sin material'
                    : `${detalle.concepto.recursos.length} ${detalle.concepto.recursos.length === 1 ? 'material' : 'materiales'}`}
                </p>

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Se usa en
                  </h3>
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
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Conceptos relacionados
                  </h3>
                  {relacionados.length === 0 ? (
                    <p className="text-xs text-slate-400">Sin conexiones todavía.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {relacionados.map((r) => (
                        <li key={r.id}>
                          <button
                            onClick={() => setSeleccionado(r.id)}
                            title={r.via}
                            className="rounded-full bg-marca-50 px-2.5 py-1 text-xs text-marca-700 hover:bg-marca-100"
                          >
                            {r.etiqueta}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <Boton variante="secundario" onClick={() => abrirFicha(detalle.concepto.id)}>
                  Abrir ficha completa
                </Boton>
              </div>
            )}
          </aside>
        )}

        {/* Área del grafo */}
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
              <div className="pointer-events-none absolute bottom-4 right-4 rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-400 shadow-sm">
                Toca un concepto para ver sus conexiones
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
