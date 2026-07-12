import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import {
  ETIQUETAS_RELACION,
  type FichaConceptoDTO,
  type GrafoDTO,
  type NodoGrafoDTO,
  type TipoAristaGrafo
} from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
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
const ETIQUETA_ARISTA: Record<string, string> = Object.fromEntries(TIPOS_ARISTA.map((t) => [t.tipo, t.etiqueta]))

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
  { selector: 'edge', style: { 'curve-style': 'bezier', width: 1.5, 'line-color': '#cbd5e1' } },
  { selector: 'edge[tipo="coocurre"]', style: { 'line-color': '#818cf8', 'line-style': 'dashed' } },
  { selector: 'edge[tipo="prerequisito_de"]', style: { 'line-color': '#ef4444', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#ef4444' } },
  { selector: 'edge[tipo="relacionado_con"]', style: { 'line-color': '#64748b' } },
  { selector: 'edge[tipo="profundiza"]', style: { 'line-color': '#10b981', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#10b981' } },
  { selector: '.atenuado', style: { opacity: 0.1 } },
  { selector: 'node.foco', style: { 'border-width': 3, 'border-color': '#4338ca' } }
]

function elementosVisibles(grafo: GrafoDTO, tipos: Set<TipoAristaGrafo>): cytoscape.ElementDefinition[] {
  const aristas = grafo.aristas.filter((a) => tipos.has(a.tipo))
  return [
    ...grafo.nodos.map((n) => ({
      data: {
        id: n.id,
        etiqueta: n.etiqueta,
        tipo: n.tipo,
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

export function GrafoPage(): JSX.Element {
  const [grafo, setGrafo] = useState<GrafoDTO | null>(null)
  const [tipos, setTipos] = useState<Set<TipoAristaGrafo>>(() => new Set(TIPOS_ARISTA.map((t) => t.tipo)))
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [modalId, setModalId] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<FichaConceptoDTO | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; texto: string } | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)

  const notificarError = useUiStore((s) => s.notificarError)
  const irASeccion = useUiStore((s) => s.irASeccion)
  const seleccionarConcepto = useUiStore((s) => s.seleccionarConcepto)
  const cargarConceptos = useConceptosStore((s) => s.cargar)

  useEffect(() => {
    api.obtenerGrafo().then(setGrafo).catch((e) => notificarError(e))
  }, [notificarError])

  const elementos = useMemo(() => (grafo ? elementosVisibles(grafo, tipos) : []), [grafo, tipos])

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
    cy.on('mouseover', 'node[tipo="asignatura"]', (evt) => {
      const p = evt.target.renderedPosition()
      setTooltip({ x: p.x, y: p.y, texto: String(evt.target.data('etiqueta')) })
    })
    cy.on('mouseout', 'node[tipo="asignatura"]', () => setTooltip(null))
    cy.on('pan zoom', () => setTooltip(null))

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

  // Resalta el vecindario del nodo seleccionado (filtra visualmente el grafo).
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().removeClass('atenuado').removeClass('foco')
    if (!seleccionado) return
    const nodo = cy.getElementById(`c:${seleccionado}`)
    if (nodo.nonempty()) {
      cy.elements().addClass('atenuado')
      nodo.removeClass('atenuado').addClass('foco')
      nodo.neighborhood().removeClass('atenuado')
    }
  }, [seleccionado, elementos])

  // Carga el detalle para la modal.
  useEffect(() => {
    if (!modalId) {
      setDetalle(null)
      return
    }
    setDetalle(null)
    api.obtenerFichaConcepto(modalId).then(setDetalle).catch((e) => notificarError(e))
  }, [modalId, notificarError])

  const alternarTipo = (t: TipoAristaGrafo): void =>
    setTipos((prev) => {
      const s = new Set(prev)
      s.has(t) ? s.delete(t) : s.add(t)
      return s
    })

  const conceptos = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (grafo?.nodos ?? [])
      .filter((n): n is NodoGrafoDTO => n.tipo === 'concepto' && n.etiqueta.toLowerCase().includes(q))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
  }, [grafo, busqueda])

  const relacionados = grafo && seleccionado ? relacionadosDe(grafo, seleccionado) : []
  const nombreSel = grafo?.nodos.find((n) => n.id === `c:${seleccionado}`)?.etiqueta
  const vacio = grafo !== null && grafo.nodos.length === 0

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
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
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
            </>
          )}
        </div>

        {/* Panel derecho: lista de nodos + relacionados */}
        <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar concepto…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Conceptos ({conceptos.length})
            </p>
            <ul className="space-y-0.5">
              {conceptos.map((c) => {
                const id = c.id.slice(2)
                const activo = id === seleccionado
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSeleccionado(id)}
                      onDoubleClick={() => setModalId(id)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                        activo ? 'bg-marca-50 text-marca-700' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{c.etiqueta}</span>
                      {c.peso > 0 && <span className="ml-2 shrink-0 text-xs text-slate-400">{c.peso}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>

            {seleccionado && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Relacionados con «{nombreSel}»
                  </p>
                </div>
                {relacionados.length === 0 ? (
                  <p className="px-1 text-xs text-slate-400">Sin conexiones todavía.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {relacionados.map((r) => (
                      <li key={r.id}>
                        <button
                          onClick={() => setModalId(r.id)}
                          title={`${r.via} · ver detalle`}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-marca-400" />
                          <span className="truncate">{r.etiqueta}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Boton variante="secundario" className="mt-3 w-full" onClick={() => setModalId(seleccionado)}>
                  Ver descripción y datos
                </Boton>
              </div>
            )}
          </div>
        </aside>
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
    </div>
  )
}
