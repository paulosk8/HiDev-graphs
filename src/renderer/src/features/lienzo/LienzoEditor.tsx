import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LadoNodoDTO, LienzoDTO, NodoLienzoDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { api } from '../../lib/api'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'
import { useVistazoStore } from '../../stores/vistazoStore'
import { BuscadorConceptos } from '../vinculos/BuscadorConceptos'

/**
 * Lienzo: mapa conceptual libre. El docente coloca tarjetas donde quiere y las
 * conecta a mano.
 *
 * Por qué DOM + SVG y no Cytoscape (que ya está en el proyecto): el Mapa de
 * conceptos CALCULA la disposición; aquí la decide el docente y se guarda. Y
 * las tarjetas tienen que poder mostrar contenido rico y editarse, cosa que un
 * lienzo de Cytoscape no da. Las tarjetas son DOM y las líneas un SVG debajo.
 *
 * Las tarjetas guardan solo la REFERENCIA a lo que ya existe (`conceptos/<id>/
 * concepto.yaml`): lo que se ve sale del concepto de verdad, así que no hay
 * copia que se desincronice.
 */

/** Cuánto se separa el punto de anclaje del borde, para que la línea respire. */
const MARGEN_ANCLA = 6

interface Punto {
  x: number
  y: number
}

/** Punto de anclaje de una conexión en un lado concreto de la tarjeta. */
function anclaDe(nodo: NodoLienzoDTO, lado: LadoNodoDTO): Punto {
  const medioX = nodo.x + nodo.width / 2
  const medioY = nodo.y + nodo.height / 2
  switch (lado) {
    case 'top':
      return { x: medioX, y: nodo.y - MARGEN_ANCLA }
    case 'bottom':
      return { x: medioX, y: nodo.y + nodo.height + MARGEN_ANCLA }
    case 'left':
      return { x: nodo.x - MARGEN_ANCLA, y: medioY }
    default:
      return { x: nodo.x + nodo.width + MARGEN_ANCLA, y: medioY }
  }
}

/**
 * Curva entre dos anclas. Se usa una Bézier con los tiradores salientes del
 * lado correspondiente: una recta entre dos tarjetas cercanas se confunde con
 * el borde de la tarjeta, y una curva deja claro de dónde sale y a dónde va.
 */
function curva(a: Punto, ladoA: LadoNodoDTO, b: Punto, ladoB: LadoNodoDTO): string {
  const fuerza = Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) / 2)
  const tirador = (p: Punto, lado: LadoNodoDTO): Punto =>
    lado === 'left'
      ? { x: p.x - fuerza, y: p.y }
      : lado === 'right'
        ? { x: p.x + fuerza, y: p.y }
        : lado === 'top'
          ? { x: p.x, y: p.y - fuerza }
          : { x: p.x, y: p.y + fuerza }
  const t1 = tirador(a, ladoA)
  const t2 = tirador(b, ladoB)
  return `M ${a.x} ${a.y} C ${t1.x} ${t1.y}, ${t2.x} ${t2.y}, ${b.x} ${b.y}`
}

let contador = 0
const nuevoId = (prefijo: string): string => `${prefijo}-${Date.now().toString(36)}-${++contador}`

export function LienzoEditor({
  lienzoId,
  onVolver
}: {
  lienzoId: string
  onVolver: () => void
}): JSX.Element {
  const notificarError = useUiStore((s) => s.notificarError)
  const conceptos = useConceptosStore((s) => s.lista)
  const abrirVistazo = useVistazoStore((s) => s.abrir)

  const [lienzo, setLienzo] = useState<LienzoDTO | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [sinGuardar, setSinGuardar] = useState(false)
  const [agregando, setAgregando] = useState(false)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  /** Conexión a medias: de qué tarjeta y lado salió. */
  const [conectando, setConectando] = useState<{ nodo: string; lado: LadoNodoDTO } | null>(null)
  const [raton, setRaton] = useState<Punto>({ x: 0, y: 0 })
  const superficie = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    void api
      .obtenerLienzo(lienzoId)
      .then((l) => vivo && setLienzo(l))
      .catch((e) => {
        if (vivo) {
          notificarError(e)
          onVolver()
        }
      })
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [lienzoId, notificarError, onVolver])

  const nombrePorConcepto = useMemo(
    () => new Map(conceptos.map((c) => [c.id, c])),
    [conceptos]
  )

  /** Toda modificación pasa por aquí, para marcar que hay cambios pendientes. */
  const cambiar = useCallback((fn: (l: LienzoDTO) => LienzoDTO): void => {
    setLienzo((actual) => (actual ? fn(actual) : actual))
    setSinGuardar(true)
  }, [])

  const guardar = async (): Promise<void> => {
    if (!lienzo) return
    setGuardando(true)
    try {
      setLienzo(await api.guardarLienzo(lienzo))
      setSinGuardar(false)
    } catch (error) {
      notificarError(error)
    } finally {
      setGuardando(false)
    }
  }

  // Guardado automático con retardo: el docente mueve tarjetas sin parar y no
  // debería tener que acordarse de guardar, pero tampoco escribir en cada píxel.
  useEffect(() => {
    if (!sinGuardar || !lienzo) return
    const t = setTimeout(() => void guardar(), 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinGuardar, lienzo])

  const posicionEnLienzo = (e: { clientX: number; clientY: number }): Punto => {
    const caja = superficie.current?.getBoundingClientRect()
    return {
      x: e.clientX - (caja?.left ?? 0) + (superficie.current?.scrollLeft ?? 0),
      y: e.clientY - (caja?.top ?? 0) + (superficie.current?.scrollTop ?? 0)
    }
  }

  /** Arrastrar una tarjeta. Se escucha en window para no perderla al ir rápido. */
  const empezarArrastre = (e: React.MouseEvent, nodo: NodoLienzoDTO): void => {
    if (e.button !== 0) return
    e.preventDefault()
    setSeleccion(nodo.id)
    const inicio = posicionEnLienzo(e)
    const original = { x: nodo.x, y: nodo.y }

    const mover = (ev: MouseEvent): void => {
      const p = posicionEnLienzo(ev)
      cambiar((l) => ({
        ...l,
        nodes: l.nodes.map((n) =>
          n.id === nodo.id
            ? { ...n, x: original.x + (p.x - inicio.x), y: original.y + (p.y - inicio.y) }
            : n
        )
      }))
    }
    const soltar = (): void => {
      window.removeEventListener('mousemove', mover)
      window.removeEventListener('mouseup', soltar)
    }
    window.addEventListener('mousemove', mover)
    window.addEventListener('mouseup', soltar)
  }

  const agregarConcepto = (conceptoId: string): void => {
    const c = nombrePorConcepto.get(conceptoId)
    cambiar((l) => ({
      ...l,
      nodes: [
        ...l.nodes,
        {
          id: nuevoId('n'),
          type: 'file',
          // Se coloca en escalera para que no se apilen unas sobre otras.
          x: 60 + l.nodes.length * 30,
          y: 60 + l.nodes.length * 24,
          width: 260,
          height: 150,
          file: `conceptos/${conceptoId}/concepto.yaml`,
          ...(c ? {} : {})
        }
      ]
    }))
    setAgregando(false)
  }

  const conectar = (nodoDestino: string, ladoDestino: LadoNodoDTO): void => {
    if (!conectando || conectando.nodo === nodoDestino) {
      setConectando(null)
      return
    }
    cambiar((l) => ({
      ...l,
      edges: [
        ...l.edges,
        {
          id: nuevoId('e'),
          fromNode: conectando.nodo,
          fromSide: conectando.lado,
          toNode: nodoDestino,
          toSide: ladoDestino
        }
      ]
    }))
    setConectando(null)
  }

  const eliminarNodo = (id: string): void =>
    cambiar((l) => ({
      ...l,
      nodes: l.nodes.filter((n) => n.id !== id),
      // Sin esto quedarían líneas colgando hacia una tarjeta que ya no está.
      edges: l.edges.filter((e) => e.fromNode !== id && e.toNode !== id)
    }))

  const eliminarArista = (id: string): void =>
    cambiar((l) => ({ ...l, edges: l.edges.filter((e) => e.id !== id) }))

  // Suprimir borra lo seleccionado; Escape cancela una conexión a medias.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setConectando(null)
      const enCampo = (e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA/)
      if ((e.key === 'Delete' || e.key === 'Backspace') && seleccion && !enCampo) {
        eliminarNodo(seleccion)
        setSeleccion(null)
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccion])

  if (cargando) return <p className="px-8 py-10 text-sm text-slate-400">Cargando…</p>
  if (!lienzo) return <p className="px-8 py-10 text-sm text-slate-400">No encontrado.</p>

  const porId = new Map(lienzo.nodes.map((n) => [n.id, n]))
  const nodoConectando = conectando ? porId.get(conectando.nodo) : undefined

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 px-6 py-3">
        <button onClick={onVolver} className="text-sm text-slate-500 hover:text-slate-800">
          ← Lienzos
        </button>
        <h1 className="flex-1 truncate text-lg font-semibold text-slate-900">{lienzo.nombre}</h1>
        <span className="text-xs text-slate-400">
          {guardando ? 'Guardando…' : sinGuardar ? 'Cambios sin guardar' : 'Guardado'}
        </span>
        <Boton variante="secundario" onClick={() => setAgregando(true)}>
          + Añadir concepto
        </Boton>
      </header>

      {conectando && (
        <p className="bg-marca-50 px-6 py-1.5 text-xs text-marca-700">
          Elige el punto de otra tarjeta para conectarla. Escape para cancelar.
        </p>
      )}

      <div
        ref={superficie}
        onMouseMove={(e) => conectando && setRaton(posicionEnLienzo(e))}
        onMouseDown={(e) => {
          // Pinchar el fondo deselecciona y cancela lo que estuviera a medias.
          if (e.target === e.currentTarget) {
            setSeleccion(null)
            setConectando(null)
          }
        }}
        className="relative flex-1 overflow-auto bg-slate-50"
        style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      >
        {/* Las líneas van DEBAJO de las tarjetas para no tapar su contenido. */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ minHeight: 2000, minWidth: 3000 }}>
          <defs>
            <marker id="punta" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
              <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
            </marker>
          </defs>
          {lienzo.edges.map((e) => {
            const desde = porId.get(e.fromNode)
            const hasta = porId.get(e.toNode)
            if (!desde || !hasta) return null
            const a = anclaDe(desde, e.fromSide)
            const b = anclaDe(hasta, e.toSide)
            return (
              <g key={e.id}>
                <path
                  d={curva(a, e.fromSide, b, e.toSide)}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  markerEnd="url(#punta)"
                />
                {/* Trazo ancho e invisible: da una zona de clic cómoda. */}
                <path
                  d={curva(a, e.fromSide, b, e.toSide)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  className="pointer-events-auto cursor-pointer"
                  onDoubleClick={() => eliminarArista(e.id)}
                >
                  <title>Doble clic para quitar la conexión</title>
                </path>
              </g>
            )
          })}

          {/* Conexión en curso, siguiendo al ratón. */}
          {conectando && nodoConectando && (
            <path
              d={curva(anclaDe(nodoConectando, conectando.lado), conectando.lado, raton, 'left')}
              fill="none"
              stroke="#6366f1"
              strokeWidth={2}
              strokeDasharray="5 4"
            />
          )}
        </svg>

        {lienzo.nodes.map((n) => (
          <TarjetaLienzo
            key={n.id}
            nodo={n}
            seleccionada={seleccion === n.id}
            concepto={nombrePorConcepto.get(conceptoDeArchivo(n.file) ?? '')}
            onArrastrar={(e) => empezarArrastre(e, n)}
            onAncla={(lado) => (conectando ? conectar(n.id, lado) : setConectando({ nodo: n.id, lado }))}
            onAbrir={() => {
              const id = conceptoDeArchivo(n.file)
              if (id) abrirVistazo(id)
            }}
            onEliminar={() => eliminarNodo(n.id)}
          />
        ))}

        {lienzo.nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="mb-2 text-3xl" aria-hidden>
              🗺️
            </div>
            <p className="text-sm font-medium text-slate-700">Este lienzo está vacío</p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Añade conceptos que ya tengas y colócalos como quieras. Arrastra desde un punto de
              una tarjeta hasta otra para conectarlas.
            </p>
            <Boton variante="primario" className="mt-4" onClick={() => setAgregando(true)}>
              + Añadir concepto
            </Boton>
          </div>
        )}
      </div>

      {agregando && (
        <div className="absolute right-6 top-20 z-30">
          <BuscadorConceptos
            excluir={lienzo.nodes.map((n) => conceptoDeArchivo(n.file) ?? '').filter(Boolean)}
            onSeleccionar={agregarConcepto}
            onCerrar={() => setAgregando(false)}
          />
        </div>
      )}
    </div>
  )
}

/** Id del concepto al que apunta una tarjeta, o null. */
function conceptoDeArchivo(file: string | undefined): string | null {
  if (!file) return null
  const m = /^conceptos\/([^/]+)\/concepto\.yaml$/.exec(file)
  return m ? m[1] : null
}

function TarjetaLienzo({
  nodo,
  seleccionada,
  concepto,
  onArrastrar,
  onAncla,
  onAbrir,
  onEliminar
}: {
  nodo: NodoLienzoDTO
  seleccionada: boolean
  concepto?: { nombre: string; descripcion: string; etiquetas: string[]; totalRecursos: number }
  onArrastrar: (e: React.MouseEvent) => void
  onAncla: (lado: LadoNodoDTO) => void
  onAbrir: () => void
  onEliminar: () => void
}): JSX.Element {
  const lados: LadoNodoDTO[] = ['top', 'right', 'bottom', 'left']
  const posicionAncla: Record<LadoNodoDTO, string> = {
    top: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2',
    right: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
    bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
    left: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2'
  }

  return (
    <div
      onMouseDown={onArrastrar}
      onDoubleClick={onAbrir}
      style={{ left: nodo.x, top: nodo.y, width: nodo.width, height: nodo.height }}
      className={`group absolute cursor-move rounded-xl border bg-white p-3 shadow-sm transition-shadow ${
        seleccionada ? 'border-marca-500 shadow-md' : 'border-slate-200 hover:shadow'
      }`}
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 truncate text-sm font-medium text-slate-800">
          {concepto?.nombre ?? 'Concepto no encontrado'}
        </p>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onEliminar}
          className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
          aria-label="Quitar del lienzo"
        >
          ✕
        </button>
      </div>

      {concepto?.descripcion && (
        <p className="mt-1 line-clamp-3 text-xs text-slate-500">{concepto.descripcion}</p>
      )}

      {concepto && concepto.etiquetas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {concepto.etiquetas.slice(0, 3).map((e) => (
            <span key={e} className="rounded-full bg-marca-50 px-2 py-0.5 text-[10px] text-marca-700">
              {e}
            </span>
          ))}
        </div>
      )}

      {concepto && concepto.totalRecursos > 0 && (
        <p className="absolute bottom-2 left-3 text-[10px] text-slate-400">
          📎 {concepto.totalRecursos}
        </p>
      )}

      {/* Puntos de conexión: aparecen al pasar el ratón para no ensuciar. */}
      {lados.map((lado) => (
        <button
          key={lado}
          onMouseDown={(e) => {
            e.stopPropagation()
            onAncla(lado)
          }}
          title="Arrastra hasta otra tarjeta para conectarlas"
          className={`absolute h-3 w-3 rounded-full border-2 border-white bg-marca-500 opacity-0 transition group-hover:opacity-100 ${posicionAncla[lado]}`}
        />
      ))}
    </div>
  )
}
