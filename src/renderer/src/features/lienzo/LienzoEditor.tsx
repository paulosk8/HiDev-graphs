import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LadoNodoDTO, LienzoDTO, NodoLienzoDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { api } from '../../lib/api'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'
import { useVistazoStore } from '../../stores/vistazoStore'
import { BuscadorConceptos } from '../vinculos/BuscadorConceptos'
import { SelectorMaterial } from './SelectorMaterial'
import { NotaEnTarjeta } from './NotaEnTarjeta'
import { colorDeArista, COLORES_ARISTA, COLORES_GRUPO, colorDeGrupo } from './coloresLienzo'
import { TEMAS_OSCUROS, useLayoutStore } from '../../stores/layoutStore'

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

/** Tamaño del área de dibujo. Generoso, pero acotado: un lienzo infinito
 *  impide saber dónde está lo que ya has puesto. */
const ANCHO_LIENZO = 3000
const ALTO_LIENZO = 2000

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
  /** Arista cuyo estilo se está editando (etiqueta y color). */
  const [aristaEditando, setAristaEditando] = useState<string | null>(null)
  /** Tarjeta de texto que se está escribiendo. */
  const [textoEditando, setTextoEditando] = useState<string | null>(null)
  const [eligiendoMaterial, setEligiendoMaterial] = useState(false)
  /** Tarjeta de concepto cuya nota se está editando dentro del lienzo. */
  const [notaEditando, setNotaEditando] = useState<string | null>(null)
  /** Selección múltiple: agrupar exige poder elegir varias tarjetas. */
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  /** Recuadro de selección en curso (arrastrando sobre el fondo). */
  const [recuadro, setRecuadro] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
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

    // Mayúsculas suma o quita de la selección; un clic normal la reemplaza,
    // salvo que la tarjeta ya estuviera dentro (para arrastrar el conjunto).
    let objetivos: string[]
    if (e.shiftKey) {
      const s = new Set(seleccion)
      s.has(nodo.id) ? s.delete(nodo.id) : s.add(nodo.id)
      setSeleccion(s)
      objetivos = [...s]
    } else if (seleccion.has(nodo.id)) {
      objetivos = [...seleccion]
    } else {
      setSeleccion(new Set([nodo.id]))
      objetivos = [nodo.id]
    }

    // Un grupo arrastra lo que contiene: si no, moverlo lo vaciaría.
    const arrastrados = new Set(objetivos)
    if (nodo.type === 'group') for (const c of contenidosEn(nodo)) arrastrados.add(c)

    const inicio = posicionEnLienzo(e)
    const originales = new Map(
      (lienzo?.nodes ?? []).filter((n) => arrastrados.has(n.id)).map((n) => [n.id, { x: n.x, y: n.y }])
    )

    const mover = (ev: MouseEvent): void => {
      const p = posicionEnLienzo(ev)
      cambiar((l) => ({
        ...l,
        nodes: l.nodes.map((n) => {
          const o = originales.get(n.id)
          return o ? { ...n, x: o.x + (p.x - inicio.x), y: o.y + (p.y - inicio.y) } : n
        })
      }))
    }
    const soltar = (): void => {
      window.removeEventListener('mousemove', mover)
      window.removeEventListener('mouseup', soltar)
    }
    window.addEventListener('mousemove', mover)
    window.addEventListener('mouseup', soltar)
  }

  /** Ids de las tarjetas que caen dentro de un grupo (no otros grupos). */
  const contenidosEn = (grupo: NodoLienzoDTO): string[] =>
    (lienzo?.nodes ?? [])
      .filter(
        (n) =>
          n.id !== grupo.id &&
          n.type !== 'group' &&
          n.x >= grupo.x &&
          n.y >= grupo.y &&
          n.x + n.width <= grupo.x + grupo.width &&
          n.y + n.height <= grupo.y + grupo.height
      )
      .map((n) => n.id)

  /** Crea un grupo que envuelve lo seleccionado, con un margen para su título. */
  const agrupar = (): void => {
    if (!lienzo || seleccion.size < 2) return
    const dentro = lienzo.nodes.filter((n) => seleccion.has(n.id) && n.type !== 'group')
    if (dentro.length < 2) return

    const margen = 24
    const x = Math.min(...dentro.map((n) => n.x)) - margen
    // Arriba hace falta más hueco: ahí va el título del grupo.
    const y = Math.min(...dentro.map((n) => n.y)) - margen - 20
    const x2 = Math.max(...dentro.map((n) => n.x + n.width)) + margen
    const y2 = Math.max(...dentro.map((n) => n.y + n.height)) + margen

    const id = nuevoId('g')
    cambiar((l) => ({
      ...l,
      // El grupo va PRIMERO en la lista para pintarse debajo de las tarjetas.
      nodes: [
        { id, type: 'group' as const, x, y, width: x2 - x, height: y2 - y, label: 'Grupo' },
        ...l.nodes
      ]
    }))
    setSeleccion(new Set([id]))
  }

  /** Quita el grupo pero conserva sus tarjetas: agrupar no es meter en una caja. */
  const desagrupar = (id: string): void =>
    cambiar((l) => ({
      ...l,
      nodes: l.nodes.filter((n) => n.id !== id),
      edges: l.edges.filter((e) => e.fromNode !== id && e.toNode !== id)
    }))

  const renombrarGrupo = (id: string, label: string): void =>
    cambiar((l) => ({ ...l, nodes: l.nodes.map((n) => (n.id === id ? { ...n, label } : n)) }))

  const colorearGrupo = (id: string, clave: string): void =>
    cambiar((l) => ({
      ...l,
      nodes: l.nodes.map((n) => (n.id === id ? { ...n, color: clave || undefined } : n))
    }))

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

  /** Tarjeta de texto libre: para lo que no es un concepto (una idea, un aviso). */
  const agregarTexto = (): void => {
    const id = nuevoId('n')
    cambiar((l) => ({
      ...l,
      nodes: [
        ...l.nodes,
        { id, type: 'text' as const, x: 80, y: 80 + l.nodes.length * 24, width: 240, height: 120, text: '' }
      ]
    }))
    setTextoEditando(id)
  }

  const cambiarTexto = (id: string, texto: string): void =>
    cambiar((l) => ({ ...l, nodes: l.nodes.map((n) => (n.id === id ? { ...n, text: texto } : n)) }))

  const agregarMaterial = (conceptoId: string, recurso: { archivo: string }): void => {
    cambiar((l) => ({
      ...l,
      nodes: [
        ...l.nodes,
        {
          id: nuevoId('n'),
          type: 'file' as const,
          x: 80 + l.nodes.length * 28,
          y: 100 + l.nodes.length * 22,
          width: 260,
          height: 200,
          file: `conceptos/${conceptoId}/${recurso.archivo}`
        }
      ]
    }))
    setEligiendoMaterial(false)
  }

  const cambiarArista = (id: string, campos: { label?: string; color?: string }): void =>
    cambiar((l) => ({
      ...l,
      edges: l.edges.map((e) =>
        e.id === id
          ? {
              ...e,
              ...(campos.label !== undefined ? { label: campos.label || undefined } : {}),
              ...(campos.color !== undefined ? { color: campos.color || undefined } : {})
            }
          : e
      )
    }))

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
      if ((e.key === 'Delete' || e.key === 'Backspace') && seleccion.size > 0 && !enCampo) {
        for (const id of seleccion) eliminarNodo(id)
        setSeleccion(new Set())
      }
      // Ctrl/Cmd+G agrupa, como en cualquier herramienta de dibujo.
      if ((e.key === 'g' || e.key === 'G') && (e.ctrlKey || e.metaKey) && !enCampo) {
        e.preventDefault()
        agrupar()
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
    // `overflow-hidden` + `min-w-0`: sin esto, el área de dibujo (3000 px)
    // ensancha el <main> de la app y aparece un scroll horizontal en TODA la
    // ventana, que arrastra el menú lateral fuera de la vista.
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-slate-200 px-6 py-3">
        <button onClick={onVolver} className="text-sm text-slate-500 hover:text-slate-800">
          ← Lienzos
        </button>
        <h1 className="flex-1 truncate text-lg font-semibold text-slate-900">{lienzo.nombre}</h1>
        <span className="text-xs text-slate-400">
          {guardando ? 'Guardando…' : sinGuardar ? 'Cambios sin guardar' : 'Guardado'}
        </span>
        {seleccion.size >= 2 && (
          <Boton variante="secundario" onClick={agrupar}>
            Agrupar ({seleccion.size})
          </Boton>
        )}
        <Boton variante="secundario" onClick={() => setEligiendoMaterial(true)}>
          + Material
        </Boton>
        <Boton variante="secundario" onClick={agregarTexto}>
          + Nota suelta
        </Boton>
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
          if (e.target !== e.currentTarget || e.button !== 0) return
          setConectando(null)
          if (!e.shiftKey) setSeleccion(new Set())

          // Arrastrar sobre el fondo dibuja un recuadro y selecciona lo que toca.
          const inicio = posicionEnLienzo(e)
          const mover = (ev: MouseEvent): void => {
            const p = posicionEnLienzo(ev)
            setRecuadro({ x1: inicio.x, y1: inicio.y, x2: p.x, y2: p.y })
          }
          const soltar = (ev: MouseEvent): void => {
            window.removeEventListener('mousemove', mover)
            window.removeEventListener('mouseup', soltar)
            const p = posicionEnLienzo(ev)
            const izq = Math.min(inicio.x, p.x)
            const arr = Math.min(inicio.y, p.y)
            const der = Math.max(inicio.x, p.x)
            const aba = Math.max(inicio.y, p.y)
            setRecuadro(null)
            // Un recuadro minúsculo es un clic, no una selección.
            if (der - izq < 5 && aba - arr < 5) return
            const tocados = (lienzo?.nodes ?? [])
              .filter(
                (n) =>
                  n.x < der && n.x + n.width > izq && n.y < aba && n.y + n.height > arr
              )
              .map((n) => n.id)
            setSeleccion((s) => new Set(ev.shiftKey ? [...s, ...tocados] : tocados))
          }
          window.addEventListener('mousemove', mover)
          window.addEventListener('mouseup', soltar)
        }}
        className="relative min-h-0 flex-1 overflow-auto bg-slate-50"
        style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      >
        {/* Las líneas van DEBAJO de las tarjetas para no tapar su contenido. */}
        {/* Área de dibujo con tamaño propio: el scroll ocurre AQUÍ dentro, no
            en la ventana. Antes lo fijaba el `min-width` del SVG, que al ser
            absoluto ensanchaba a su vez el contenedor de la aplicación. */}
        <div className="relative" style={{ width: ANCHO_LIENZO, height: ALTO_LIENZO }}>
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
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
                  stroke={colorDeArista(e.color)}
                  strokeWidth={aristaEditando === e.id ? 3 : 2}
                  markerEnd="url(#punta)"
                />
                {e.label && (
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 6}
                    textAnchor="middle"
                    className="pointer-events-none"
                    style={{ fontSize: 11, fill: colorDeArista(e.color), paintOrder: 'stroke' }}
                    stroke="#f8fafc"
                    strokeWidth={4}
                  >
                    {e.label}
                  </text>
                )}
                {/* Trazo ancho e invisible: da una zona de clic cómoda. */}
                <path
                  d={curva(a, e.fromSide, b, e.toSide)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => setAristaEditando(aristaEditando === e.id ? null : e.id)}
                  onDoubleClick={() => eliminarArista(e.id)}
                >
                  <title>Clic para poner nombre o color · doble clic para quitarla</title>
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

        {lienzo.nodes
          .filter((n) => n.type === 'group')
          .map((g) => (
            <GrupoLienzo
              key={g.id}
              nodo={g}
              seleccionado={seleccion.has(g.id)}
              onArrastrar={(e) => empezarArrastre(e, g)}
              onRenombrar={(v) => renombrarGrupo(g.id, v)}
              onColor={(c) => colorearGrupo(g.id, c)}
              onQuitar={() => desagrupar(g.id)}
            />
          ))}

        {recuadro && (
          <div
            className="pointer-events-none absolute border-2 border-marca-500 bg-marca-500/10"
            style={{
              left: Math.min(recuadro.x1, recuadro.x2),
              top: Math.min(recuadro.y1, recuadro.y2),
              width: Math.abs(recuadro.x2 - recuadro.x1),
              height: Math.abs(recuadro.y2 - recuadro.y1)
            }}
          />
        )}

        {lienzo.nodes
          .filter((n) => n.type === 'text')
          .map((n) => (
            <TarjetaTexto
              key={n.id}
              nodo={n}
              seleccionada={seleccion.has(n.id)}
              editando={textoEditando === n.id}
              onArrastrar={(e) => empezarArrastre(e, n)}
              onEditar={() => setTextoEditando(n.id)}
              onCambiar={(v) => cambiarTexto(n.id, v)}
              onTerminar={() => setTextoEditando(null)}
              onAncla={(lado) =>
                conectando ? conectar(n.id, lado) : setConectando({ nodo: n.id, lado })
              }
              onEliminar={() => eliminarNodo(n.id)}
            />
          ))}

        {lienzo.nodes
          .filter((n) => n.type === 'file')
          .map((n) => (
          <TarjetaLienzo
            key={n.id}
            nodo={n}
            seleccionada={seleccion.has(n.id)}
            concepto={nombrePorConcepto.get(conceptoDeArchivo(n.file) ?? '')}
            onArrastrar={(e) => empezarArrastre(e, n)}
            onAncla={(lado) => (conectando ? conectar(n.id, lado) : setConectando({ nodo: n.id, lado }))}
            editandoNota={notaEditando === n.id}
            onAbrir={() => {
              // Un material no tiene ficha que abrir: se previsualiza en la tarjeta.
              if (materialDeArchivo(n.file)) return
              const id = conceptoDeArchivo(n.file)
              // Doble clic edita la nota aquí mismo; el vistazo queda para el
              // panel lateral, al que se llega desde la propia tarjeta.
              if (id) setNotaEditando(n.id)
            }}
            onCerrarNota={() => setNotaEditando(null)}
            onVerFicha={() => {
              const id = conceptoDeArchivo(n.file)
              if (id) abrirVistazo(id)
            }}
            onEliminar={() => eliminarNodo(n.id)}
          />
        ))}

        </div>

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

      {aristaEditando && (
        <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              defaultValue={lienzo.edges.find((e) => e.id === aristaEditando)?.label ?? ''}
              onChange={(e) => cambiarArista(aristaEditando, { label: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') setAristaEditando(null)
              }}
              placeholder="Nombre de la conexión (ej. hace falta para)"
              maxLength={40}
              className="w-64 rounded-lg border border-slate-300 px-2.5 py-1 text-sm outline-none focus:border-marca-500"
            />
            {COLORES_ARISTA.map((c) => (
              <button
                key={c.clave || 'gris'}
                onClick={() => cambiarArista(aristaEditando, { color: c.clave })}
                title={c.nombre}
                aria-label={`Color ${c.nombre}`}
                style={{ background: c.valor }}
                className="h-4 w-4 rounded-full border border-white ring-1 ring-slate-300"
              />
            ))}
            <button
              onClick={() => {
                eliminarArista(aristaEditando)
                setAristaEditando(null)
              }}
              className="ml-1 text-xs text-red-600 hover:underline"
            >
              Quitar
            </button>
            <button
              onClick={() => setAristaEditando(null)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {eligiendoMaterial && (
        <div className="absolute right-6 top-20 z-30">
          <SelectorMaterial
            onElegir={agregarMaterial}
            onCerrar={() => setEligiendoMaterial(false)}
          />
        </div>
      )}

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

/** Concepto y archivo de una tarjeta de material, o null si no lo es. */
function materialDeArchivo(file: string | undefined): { conceptoId: string; archivo: string } | null {
  if (!file) return null
  const m = /^conceptos\/([^/]+)\/(.+)$/.exec(file)
  if (!m || m[2] === 'concepto.yaml') return null
  return { conceptoId: m[1], archivo: m[2] }
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
  editandoNota,
  onArrastrar,
  onAncla,
  onAbrir,
  onCerrarNota,
  onVerFicha,
  onEliminar
}: {
  nodo: NodoLienzoDTO
  seleccionada: boolean
  concepto?: { nombre: string; descripcion: string; etiquetas: string[]; totalRecursos: number }
  editandoNota: boolean
  onArrastrar: (e: React.MouseEvent) => void
  onAncla: (lado: LadoNodoDTO) => void
  onAbrir: () => void
  onCerrarNota: () => void
  onVerFicha: () => void
  onEliminar: () => void
}): JSX.Element {
  const material = materialDeArchivo(nodo.file)
  const conceptoId = conceptoDeArchivo(nodo.file)
  const lados: LadoNodoDTO[] = ['top', 'right', 'bottom', 'left']
  const posicionAncla: Record<LadoNodoDTO, string> = {
    top: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2',
    right: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
    bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
    left: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2'
  }

  return (
    <div
      onMouseDown={editandoNota ? undefined : onArrastrar}
      onDoubleClick={onAbrir}
      style={{ left: nodo.x, top: nodo.y, width: nodo.width, height: nodo.height }}
      className={`group absolute rounded-xl border bg-white p-3 shadow-sm transition-shadow ${
        editandoNota ? 'cursor-default' : 'cursor-move'
      } ${
        seleccionada ? 'border-marca-500 shadow-md' : 'border-slate-200 hover:shadow'
      }`}
    >
      <div className="flex items-start gap-2">
        {material && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
            {material.archivo.split('.').pop()}
          </span>
        )}
        <p className="flex-1 truncate text-sm font-medium text-slate-800">
          {material
            ? material.archivo.split('/').pop()
            : (concepto?.nombre ?? 'Concepto no encontrado')}
        </p>
        {!material && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onVerFicha}
            title="Ver la ficha completa"
            className="text-xs text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-marca-700"
          >
            ↗
          </button>
        )}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onEliminar}
          className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
          aria-label="Quitar del lienzo"
        >
          ✕
        </button>
      </div>

      {material ? (
        // El propio protocolo del vault sirve el archivo; el navegador decide
        // cómo pintarlo (imagen o PDF). Lo que no sabe abrir queda con su
        // nombre y el botón de abrir fuera, que ya existe en la ficha.
        <iframe
          title={material.archivo}
          src={`recurso://c/${material.conceptoId}/${material.archivo
            .split('/')
            .map(encodeURIComponent)
            .join('/')}`}
          className="pointer-events-none mt-2 h-[calc(100%-2.5rem)] w-full rounded border border-slate-100 bg-white"
        />
      ) : editandoNota && conceptoId ? (
        <NotaEnTarjeta conceptoId={conceptoId} onCerrar={onCerrarNota} />
      ) : (
        concepto?.descripcion && (
          <p className="mt-1 line-clamp-3 text-xs text-slate-500">{concepto.descripcion}</p>
        )
      )}

      {!material && !editandoNota && concepto && concepto.etiquetas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {concepto.etiquetas.slice(0, 3).map((e) => (
            <span key={e} className="rounded-full bg-marca-50 px-2 py-0.5 text-[10px] text-marca-700">
              {e}
            </span>
          ))}
        </div>
      )}

      {!material && !editandoNota && concepto && concepto.totalRecursos > 0 && (
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

/**
 * Caja de un grupo. Se pinta DEBAJO de las tarjetas, así que el relleno va muy
 * tenue: el color fuerte se reserva para el borde y el título, que es donde de
 * verdad se distingue un grupo de otro. Los tonos están elegidos para que el
 * título mida al menos 4,5:1 sobre su propio fondo (ver `coloresLienzo.ts`).
 */
function GrupoLienzo({
  nodo,
  seleccionado,
  onArrastrar,
  onRenombrar,
  onColor,
  onQuitar
}: {
  nodo: NodoLienzoDTO
  seleccionado: boolean
  onArrastrar: (e: React.MouseEvent) => void
  onRenombrar: (label: string) => void
  onColor: (clave: string) => void
  onQuitar: () => void
}): JSX.Element {
  const [editando, setEditando] = useState(false)
  const color = colorDeGrupo(nodo.color)
  // El título va sobre el lienzo tintado: necesita un tono u otro según si el
  // fondo es claro u oscuro. El relleno y el borde valen para ambos.
  const enOscuro = TEMAS_OSCUROS.includes(useLayoutStore((s) => s.tema))
  const colorTitulo = enOscuro ? color.textoOscuro : color.texto

  return (
    <div
      onMouseDown={onArrastrar}
      style={{
        left: nodo.x,
        top: nodo.y,
        width: nodo.width,
        height: nodo.height,
        background: color.fondo,
        borderColor: color.borde
      }}
      className={`group/grupo absolute cursor-move rounded-xl border-2 ${
        seleccionado ? 'ring-2 ring-marca-500 ring-offset-2' : ''
      }`}
    >
      <div className="flex items-center gap-1 px-3 py-1">
        {editando ? (
          <input
            autoFocus
            defaultValue={nodo.label ?? ''}
            onMouseDown={(e) => e.stopPropagation()}
            onBlur={(e) => {
              onRenombrar(e.target.value.trim() || 'Grupo')
              setEditando(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setEditando(false)
            }}
            maxLength={60}
            className="w-40 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs outline-none"
          />
        ) : (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={() => setEditando(true)}
            style={{ color: colorTitulo }}
            title="Doble clic para cambiar el nombre"
            className="truncate text-xs font-semibold uppercase tracking-wide"
          >
            {nodo.label || 'Grupo'}
          </button>
        )}

        <span className="flex-1" />

        {/* Paleta y quitar: solo al pasar el ratón, para no ensuciar el lienzo. */}
        <span className="flex items-center gap-1 opacity-0 transition group-hover/grupo:opacity-100">
          {COLORES_GRUPO.map((c) => (
            <button
              key={c.clave}
              onMouseDown={(e) => {
                e.stopPropagation()
                onColor(nodo.color === c.clave ? '' : c.clave)
              }}
              title={c.nombre}
              aria-label={`Color ${c.nombre}`}
              style={{ background: c.borde }}
              className={`h-3 w-3 rounded-full border border-white ${
                nodo.color === c.clave ? 'ring-2 ring-slate-600' : ''
              }`}
            />
          ))}
          <button
            onMouseDown={(e) => {
              e.stopPropagation()
              onQuitar()
            }}
            style={{ color: color.texto }}
            title="Quitar el grupo (las tarjetas se conservan)"
            className="ml-1 text-xs"
          >
            ✕
          </button>
        </span>
      </div>
    </div>
  )
}

/**
 * Tarjeta de texto libre: una nota adhesiva del lienzo. No pertenece a ningún
 * concepto —vive en el .canvas— y sirve para lo que no es material: un título
 * de sección, un recordatorio, una pregunta para clase.
 *
 * Se edita con doble clic, en el sitio. Abrir un formulario para dos frases
 * rompería el ritmo de estar montando un mapa.
 */
function TarjetaTexto({
  nodo,
  seleccionada,
  editando,
  onArrastrar,
  onEditar,
  onCambiar,
  onTerminar,
  onAncla,
  onEliminar
}: {
  nodo: NodoLienzoDTO
  seleccionada: boolean
  editando: boolean
  onArrastrar: (e: React.MouseEvent) => void
  onEditar: () => void
  onCambiar: (v: string) => void
  onTerminar: () => void
  onAncla: (lado: LadoNodoDTO) => void
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
      onMouseDown={editando ? undefined : onArrastrar}
      onDoubleClick={onEditar}
      // Tinte translúcido, como los grupos: un ámbar sólido solo funciona sobre
      // lienzo claro y en modo oscuro se veía como una mancha marrón.
      style={{
        left: nodo.x,
        top: nodo.y,
        width: nodo.width,
        height: nodo.height,
        background: '#f59e0b1f',
        borderColor: seleccionada || editando ? undefined : '#f59e0b66'
      }}
      className={`group absolute rounded-xl border p-3 shadow-sm ${
        editando ? 'cursor-text border-marca-500' : 'cursor-move'
      } ${seleccionada ? 'border-marca-500 shadow-md' : ''}`}
    >
      {editando ? (
        <textarea
          autoFocus
          value={nodo.text ?? ''}
          onChange={(e) => onCambiar(e.target.value)}
          onBlur={onTerminar}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onTerminar()
          }}
          placeholder="Escribe aquí…"
          className="h-full w-full resize-none border-0 bg-transparent text-sm text-slate-800 outline-none"
        />
      ) : (
        <p className="h-full overflow-hidden whitespace-pre-wrap text-sm text-slate-800">
          {nodo.text || <span className="text-slate-400">Doble clic para escribir</span>}
        </p>
      )}

      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onEliminar}
        className="absolute right-2 top-2 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
        aria-label="Quitar del lienzo"
      >
        ✕
      </button>

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
