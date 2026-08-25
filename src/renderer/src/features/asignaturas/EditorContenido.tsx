import { useEffect, useState } from 'react'
import type {
  AsignaturaDTO,
  DatosUnidadEdicionDTO,
  ResumenConceptoDTO,
  ResumenTareaDTO
} from '@shared/dtos'
import { BuscadorConceptos } from '../vinculos/BuscadorConceptos'
import { DialogoConfirmacion } from '../../components/DialogoConfirmacion'
import { DialogoMover } from '../../components/DialogoMover'
import { MenuContextual, useMenuContextual } from '../../components/MenuContextual'
import { api } from '../../lib/api'
import { useUiStore } from '../../stores/uiStore'
import { useVistazoStore } from '../../stores/vistazoStore'

// Árbol editable local (ids reales para lo existente; "tmp-*" para lo nuevo aún sin guardar).
interface SubN {
  id: string
  titulo: string
}
interface TemaN {
  id: string
  titulo: string
  subtemas: SubN[]
}
interface UniN {
  id: string
  titulo: string
  temas: TemaN[]
}

/** Borrado pendiente de confirmar. */
interface Pendiente {
  tipo: 'unidad' | 'tema' | 'sub'
  uId: string
  tId?: string
  sId?: string
  titulo: string
  mensaje: string
}

/**
 * Título del contenedor que se crea solo cuando el nivel superior está aplanado
 * (Aprendizaje). Nunca se muestra: existe para que los temas tengan de dónde
 * colgar en el modelo curricular, que es común a las dos capas.
 */
const UNIDAD_IMPLICITA = 'Contenido'

let seq = 0
const tmpId = (): string => `tmp-${++seq}`
const esTmp = (id: string): boolean => id.startsWith('tmp-')

function desdeAsignatura(a: AsignaturaDTO): UniN[] {
  return a.unidades.map((u) => ({
    id: u.id,
    titulo: u.titulo,
    temas: u.temas.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      subtemas: t.subtemas.map((s) => ({ id: s.id, titulo: s.titulo }))
    }))
  }))
}

/** Convierte el árbol al DTO de edición (descarta títulos vacíos; id solo si no es temporal). */
function aDTO(arbol: UniN[]): DatosUnidadEdicionDTO[] {
  return arbol
    .filter((u) => u.titulo.trim())
    .map((u) => ({
      ...(esTmp(u.id) ? {} : { id: u.id }),
      titulo: u.titulo.trim(),
      temas: u.temas
        .filter((t) => t.titulo.trim())
        .map((t) => ({
          ...(esTmp(t.id) ? {} : { id: t.id }),
          titulo: t.titulo.trim(),
          subtemas: t.subtemas
            .filter((s) => s.titulo.trim())
            .map((s) => ({ ...(esTmp(s.id) ? {} : { id: s.id }), titulo: s.titulo.trim() }))
        }))
    }))
}

interface Props {
  asignatura: AsignaturaDTO
  esAprendizaje: boolean
  /** Conceptos del pool, por id: dan nombre y cuánto material tiene cada uno. */
  conceptoPorId: Map<string, ResumenConceptoDTO>
  tareas: ResumenTareaDTO[]
  /** `puntoId` es el id de un tema O de un subtema: los dos aceptan conceptos. */
  onVincular: (puntoId: string, conceptoId: string) => void
  onDesvincular: (puntoId: string, conceptoId: string) => void
  onAbrirTarea: (id: string) => void
  /** Crear una tarea/práctica ya asociada a ese tema y, si se indica, a ese concepto. */
  onCrearTarea: (temaId: string, conceptoId?: string) => void
  onGuardar: (unidades: DatosUnidadEdicionDTO[]) => Promise<void>
}

export function EditorContenido({
  asignatura,
  esAprendizaje,
  conceptoPorId,
  tareas,
  onVincular,
  onDesvincular,
  onAbrirTarea,
  onCrearTarea,
  onGuardar
}: Props): JSX.Element {
  // El material sigue perteneciendo al concepto (así se reutiliza entre
  // asignaturas y períodos), pero el docente que prepara la clase lo necesita
  // aquí: el chip abre el panel lateral del concepto y desde ahí agrega
  // archivos, enlaces y notas sin salir de la asignatura.
  const abrirVistazo = useVistazoStore((s) => s.abrir)
  const [arbol, setArbol] = useState<UniN[]>(() => desdeAsignatura(asignatura))
  /**
   * Qué está plegado. Se guarda lo CERRADO y no lo abierto: así una unidad o
   * un tema recién creados salen abiertos, que es lo que se espera al crearlos.
   */
  const [cerrados, setCerrados] = useState<Set<string>>(new Set())
  const plegado = (id: string): boolean => cerrados.has(id)
  const alternarPlegado = (id: string): void =>
    setCerrados((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  const { menu, abrir: abrirMenu, cerrar: cerrarMenu } = useMenuContextual<{
    unidadId: string
    tema: TemaN
  }>()
  const [moviendo, setMoviendo] = useState<{ unidadId: string; tema: TemaN } | null>(null)
  /**
   * Reordenar arrastrando. Se guarda QUÉ se arrastra (y de qué lista) para no
   * permitir soltarlo en otra: el orden es dentro de su propio nivel.
   */
  const [arrastrando, setArrastrando] = useState<
    { nivel: 'unidad' | 'tema' | 'sub'; uId: string; tId?: string; id: string } | null
  >(null)
  /** Elemento sobre el que caería, para marcar el hueco antes de soltar. */
  const [sobre, setSobre] = useState<string | null>(null)
  const notificarError = useUiStore((s) => s.notificarError)
  const [foco, setFoco] = useState<string | null>(null)
  const [temaBuscador, setTemaBuscador] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [aEliminar, setAEliminar] = useState<Pendiente | null>(null)

  // Re-sincroniza el árbol cuando la asignatura cambia (tras guardar o vincular).
  useEffect(() => {
    setArbol(desdeAsignatura(asignatura))
  }, [asignatura])

  // Etiquetas de nivel (inequívocas en cada contexto).
  const N1 = esAprendizaje ? 'bloque' : 'tema'
  const N2 = esAprendizaje ? 'tema' : 'subtema'
  const N3 = esAprendizaje ? 'subtema' : 'sub-subtema'

  // Muestra «✓ Guardado» un instante tras un autosave.
  const marcarGuardado = (): void => {
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  const guardar = async (dto: DatosUnidadEdicionDTO[]): Promise<void> => {
    setGuardando(true)
    await onGuardar(dto)
    setGuardando(false)
    marcarGuardado()
  }

  const persistir = async (nuevo: UniN[]): Promise<void> => {
    setArbol(nuevo)
    await guardar(aDTO(nuevo))
  }

  // --- Altas (locales; se guardan al escribir el título y perder el foco) ---
  const addUnidad = (): void => {
    const id = tmpId()
    setArbol((a) => [...a, { id, titulo: '', temas: [] }])
    setFoco(id)
  }
  const addTema = (uId: string): void => {
    const id = tmpId()
    setArbol((a) => a.map((u) => (u.id === uId ? { ...u, temas: [...u.temas, { id, titulo: '', subtemas: [] }] } : u)))
    setFoco(id)
  }
  /**
   * Alta de tema con el nivel superior aplanado (Aprendizaje). El contenedor
   * curricular sigue existiendo por debajo —los temas cuelgan de una unidad—,
   * así que se crea uno implícito la primera vez y nunca se le pide nombre.
   */
  const addTemaSuelto = (): void => {
    const idTema = tmpId()
    const idUnidad = tmpId()
    setArbol((a) =>
      a.length === 0
        ? [{ id: idUnidad, titulo: UNIDAD_IMPLICITA, temas: [{ id: idTema, titulo: '', subtemas: [] }] }]
        : a.map((u, i) =>
            i === 0 ? { ...u, temas: [...u.temas, { id: idTema, titulo: '', subtemas: [] }] } : u
          )
    )
    setFoco(idTema)
  }
  const addSub = (uId: string, tId: string): void => {
    const id = tmpId()
    setArbol((a) =>
      a.map((u) =>
        u.id === uId
          ? {
              ...u,
              temas: u.temas.map((t) => (t.id === tId ? { ...t, subtemas: [...t.subtemas, { id, titulo: '' }] } : t))
            }
          : u
      )
    )
    setFoco(id)
  }

  // --- Título: edición local + persistir al perder foco (o descartar si queda vacío) ---
  const setTitulo = (nivel: 1 | 2 | 3, ids: string[], valor: string): void => {
    setArbol((a) =>
      a.map((u) => {
        if (nivel === 1) return u.id === ids[0] ? { ...u, titulo: valor } : u
        if (u.id !== ids[0]) return u
        return {
          ...u,
          temas: u.temas.map((t) => {
            if (nivel === 2) return t.id === ids[1] ? { ...t, titulo: valor } : t
            if (t.id !== ids[1]) return t
            return { ...t, subtemas: t.subtemas.map((s) => (s.id === ids[2] ? { ...s, titulo: valor } : s)) }
          })
        }
      })
    )
  }

  const alPerderFoco = (): void => {
    setFoco(null)
    // Lee el estado MÁS RECIENTE (updater funcional): descarta nodos nuevos con
    // título vacío. Solo guarda si de verdad cambió algo (evita el autosave —y su
    // aviso— cuando entras y sales de un campo sin editar nada).
    setArbol((prev) => {
      const limpio = prev
        .map((u) => ({
          ...u,
          temas: u.temas
            .map((t) => ({ ...t, subtemas: t.subtemas.filter((s) => s.titulo.trim() || !esTmp(s.id)) }))
            .filter((t) => t.titulo.trim() || !esTmp(t.id))
        }))
        .filter((u) => u.titulo.trim() || !esTmp(u.id))
        // Con el nivel superior aplanado el contenedor se crea solo: si el tema
        // que lo estrenaba se descarta por venir vacío, no debe quedar suelto.
        .filter((u) => !(esAprendizaje && esTmp(u.id) && u.temas.length === 0))
      const guardadoActual = JSON.stringify(aDTO(desdeAsignatura(asignatura)))
      if (JSON.stringify(aDTO(limpio)) !== guardadoActual) {
        queueMicrotask(() => void guardar(aDTO(limpio)))
      }
      return limpio
    })
  }

  // --- Bajas (ejecución) ---
  const quitarUnidad = (uId: string): void => void persistir(arbol.filter((u) => u.id !== uId))
  const quitarTema = (uId: string, tId: string): void =>
    void persistir(arbol.map((u) => (u.id === uId ? { ...u, temas: u.temas.filter((t) => t.id !== tId) } : u)))
  const quitarSub = (uId: string, tId: string, sId: string): void =>
    void persistir(
      arbol.map((u) =>
        u.id === uId
          ? { ...u, temas: u.temas.map((t) => (t.id === tId ? { ...t, subtemas: t.subtemas.filter((s) => s.id !== sId) } : t)) }
          : u
      )
    )

  /** Mueve un elemento delante de otro dentro de la misma lista. */
  function reordenar<T extends { id: string }>(lista: T[], origenId: string, destinoId: string): T[] {
    const desde = lista.findIndex((x) => x.id === origenId)
    const hasta = lista.findIndex((x) => x.id === destinoId)
    if (desde < 0 || hasta < 0 || desde === hasta) return lista
    const copia = [...lista]
    const [movido] = copia.splice(desde, 1)
    copia.splice(hasta, 0, movido)
    return copia
  }

  const soltarTema = (uId: string, destinoId: string): void => {
    if (!arrastrando || arrastrando.nivel !== 'tema' || arrastrando.uId !== uId) return
    void persistir(
      arbol.map((u) => (u.id === uId ? { ...u, temas: reordenar(u.temas, arrastrando.id, destinoId) } : u))
    )
    setArrastrando(null)
    setSobre(null)
  }

  const soltarUnidad = (destinoId: string): void => {
    if (!arrastrando || arrastrando.nivel !== 'unidad') return
    void persistir(reordenar(arbol, arrastrando.id, destinoId))
    setArrastrando(null)
    setSobre(null)
  }

  const soltarSub = (uId: string, tId: string, destinoId: string): void => {
    if (!arrastrando || arrastrando.nivel !== 'sub' || arrastrando.tId !== tId) return
    void persistir(
      arbol.map((u) =>
        u.id === uId
          ? {
              ...u,
              temas: u.temas.map((t) =>
                t.id === tId ? { ...t, subtemas: reordenar(t.subtemas, arrastrando.id, destinoId) } : t
              )
            }
          : u
      )
    )
    setArrastrando(null)
    setSobre(null)
  }

  /** Asa de arrastre. Va en el asa y no en la fila entera para que el título se pueda seleccionar con el ratón. */
  const asaArrastre = (
    datos: { nivel: 'unidad' | 'tema' | 'sub'; uId: string; tId?: string; id: string },
    etiqueta: string
  ): JSX.Element => (
    <span
      draggable
      onDragStart={(e) => {
        // Algunos navegadores no inician el arrastre sin datos, aunque el
        // reordenado se resuelva con el estado y no con el portapapeles.
        e.dataTransfer.setData('text/plain', datos.id)
        e.dataTransfer.effectAllowed = 'move'
        setArrastrando(datos)
      }}
      onDragEnd={() => {
        setArrastrando(null)
        setSobre(null)
      }}
      title={`Arrastra para reordenar ${etiqueta}`}
      aria-label={`Reordenar ${etiqueta}`}
      className="shrink-0 cursor-grab select-none px-1 text-slate-400 transition hover:text-slate-700 active:cursor-grabbing"
    >
      ⠿
    </span>
  )

  // Conceptos/tareas del tema (desde la asignatura, por id).
  const temaReal = (tId: string): AsignaturaDTO['unidades'][number]['temas'][number] | undefined =>
    asignatura.unidades.flatMap((u) => u.temas).find((t) => t.id === tId)

  // Igual para el 3er nivel: también puede tener conceptos vinculados.
  const subtemaReal = (
    sId: string
  ): AsignaturaDTO['unidades'][number]['temas'][number]['subtemas'][number] | undefined =>
    asignatura.unidades
      .flatMap((u) => u.temas)
      .flatMap((t) => t.subtemas)
      .find((s) => s.id === sId)

  // --- Confirmación de borrado (no se elimina directo si hay contenido) ---
  const plural = (n: number, palabra: string): string => `${n} ${palabra}${n > 1 ? 's' : ''}`

  const pedirQuitarUnidad = (u: UniN): void => {
    const hijos = u.temas.filter((t) => t.titulo.trim()).length
    if (!u.titulo.trim() && hijos === 0) return quitarUnidad(u.id) // vacío: sin confirmar
    setAEliminar({
      tipo: 'unidad',
      uId: u.id,
      titulo: u.titulo || `este ${N1}`,
      mensaje:
        hijos > 0
          ? `Se eliminará «${u.titulo}» y ${plural(hijos, N2)}. Los conceptos y su material NO se borran.`
          : `Se eliminará «${u.titulo}».`
    })
  }
  const pedirQuitarTema = (uId: string, t: TemaN): void => {
    const nSub = t.subtemas.filter((s) => s.titulo.trim()).length
    const real = temaReal(t.id)
    const nConc = real?.conceptos.length ?? 0
    const nTar = tareas.filter((x) => x.temas.includes(t.id)).length
    if (!t.titulo.trim() && nSub === 0 && nConc === 0 && nTar === 0) return quitarTema(uId, t.id)
    const extras: string[] = []
    if (nSub) extras.push(plural(nSub, N3))
    if (nConc) extras.push(`${plural(nConc, 'concepto')} vinculado${nConc > 1 ? 's' : ''}`)
    if (nTar) extras.push(plural(nTar, esAprendizaje ? 'práctica' : 'tarea'))
    setAEliminar({
      tipo: 'tema',
      uId,
      tId: t.id,
      titulo: t.titulo || `este ${N2}`,
      mensaje: `Se eliminará «${t.titulo}»${extras.length ? ` (incluye ${extras.join(', ')})` : ''}. Los conceptos y su material NO se borran.`
    })
  }
  const pedirQuitarSub = (uId: string, tId: string, sub: SubN): void => {
    const nConc = subtemaReal(sub.id)?.conceptos.length ?? 0
    if (!sub.titulo.trim() && nConc === 0) return quitarSub(uId, tId, sub.id)
    setAEliminar({
      tipo: 'sub',
      uId,
      tId,
      sId: sub.id,
      titulo: sub.titulo,
      mensaje: nConc
        ? `Se eliminará «${sub.titulo}» (incluye ${plural(nConc, 'concepto')} vinculado${nConc > 1 ? 's' : ''}). Los conceptos y su material NO se borran.`
        : `Se eliminará «${sub.titulo}».`
    })
  }

  const confirmarEliminar = (): void => {
    if (!aEliminar) return
    const p = aEliminar
    if (p.tipo === 'unidad') quitarUnidad(p.uId)
    else if (p.tipo === 'tema') quitarTema(p.uId, p.tId!)
    else quitarSub(p.uId, p.tId!, p.sId!)
    setAEliminar(null)
  }

  const inputTitulo = (
    valor: string,
    id: string,
    onChange: (v: string) => void,
    placeholder: string,
    clase = ''
  ): JSX.Element => (
    <input
      autoFocus={foco === id}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      onBlur={alPerderFoco}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      placeholder={placeholder}
      className={`rounded-md border border-transparent px-2 py-1 outline-none transition hover:border-slate-200 focus:border-marca-400 focus:bg-white focus:ring-2 focus:ring-marca-100 ${clase}`}
    />
  )

  /**
   * Fila de un tema. Vive dentro de su unidad en Docencia y suelta en la
   * lista aplanada de Aprendizaje, así que se pinta desde una función.
   */
  const filaTema = (u: UniN, t: TemaN): JSX.Element => {
    const real = temaReal(t.id)
    const tareasTema = tareas.filter((x) => x.temas.includes(t.id))
    return (
      <li
        key={t.id}
        onContextMenu={(e) => abrirMenu(e, { unidadId: u.id, tema: t })}
        onDragOver={(e) => {
          if (arrastrando?.nivel !== 'tema' || arrastrando.uId !== u.id) return
          e.preventDefault()
          setSobre(t.id)
        }}
        onDragLeave={() => setSobre((x) => (x === t.id ? null : x))}
        onDrop={(e) => {
          e.preventDefault()
          soltarTema(u.id, t.id)
        }}
        className={`rounded-lg border bg-slate-50 p-2.5 text-sm transition ${
          sobre === t.id && arrastrando?.nivel === 'tema'
            ? 'border-marca-400 ring-2 ring-marca-100'
            : 'border-slate-200'
        } ${arrastrando?.id === t.id ? 'opacity-50' : ''}`}
      >
        <div className="flex items-center gap-1">
          {asaArrastre({ nivel: 'tema', uId: u.id, id: t.id }, `este ${N2}`)}
          <button
            onClick={() => alternarPlegado(t.id)}
            title={plegado(t.id) ? `Desplegar ${N2}` : `Plegar ${N2}`}
            aria-expanded={!plegado(t.id)}
            className="shrink-0 rounded px-1 text-slate-500 transition hover:text-slate-800"
          >
            {plegado(t.id) ? '▸' : '▾'}
          </button>
          {inputTitulo(t.titulo, t.id, (v) => setTitulo(2, [u.id, t.id], v), `Título del ${N2}`, 'flex-1 font-medium text-slate-800')}
          {plegado(t.id) && t.subtemas.length > 0 && (
            <span className="shrink-0 px-1 text-xs text-slate-500">
              {t.subtemas.length}
            </span>
          )}
          <button
            onClick={() => pedirQuitarTema(u.id, t)}
            title={`Quitar ${N2}`}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-red-50 hover:text-red-600"
          >
            ✕
          </button>
        </div>

        <div className={plegado(t.id) ? 'hidden' : ''}>
        {/* Conceptos vinculados (puente), solo para temas existentes */}
        {real && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
            <span className="w-16 shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Conceptos
            </span>
            {real.conceptos.map((cid) => (
              <ChipConcepto
                key={cid}
                concepto={conceptoPorId.get(cid)}
                conceptoId={cid}
                onAbrir={() => abrirVistazo(cid)}
                onQuitar={() => onDesvincular(t.id, cid)}
                onCrearTarea={() => onCrearTarea(t.id, cid)}
                etiquetaTarea={esAprendizaje ? 'Nueva práctica' : 'Nueva tarea'}
              />
            ))}
            <span className="relative">
              <button
                onClick={() => setTemaBuscador((a) => (a === t.id ? null : t.id))}
className="rounded-full border border-dashed border-slate-400 px-2.5 py-0.5 text-xs text-slate-600 transition hover:border-marca-400 hover:bg-marca-50 hover:text-marca-700"
              >
                + Vincular concepto
              </button>
              {temaBuscador === t.id && (
                <BuscadorConceptos
                  excluir={real.conceptos}
                  onSeleccionar={(cid) => {
                    onVincular(t.id, cid)
                    setTemaBuscador(null)
                  }}
                  onCerrar={() => setTemaBuscador(null)}
                />
              )}
            </span>
          </div>
        )}

        {/* Tareas del tema. La fila se pinta aunque no haya ninguna: es desde
            donde se crean, ya asociadas a este tema. Solo para temas guardados:
            uno recién escrito todavía no tiene id al que colgarlas. */}
        {real && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
            <span className="w-16 shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {esAprendizaje ? 'Prácticas' : 'Tareas'}
            </span>
            {tareasTema.map((x) => (
              <button
                key={x.id}
                onClick={() => onAbrirTarea(x.id)}
                title={`Abrir «${x.titulo}»`}
                className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800 transition hover:border-amber-400"
              >
                {x.titulo}
              </button>
            ))}
            <button
              onClick={() => onCrearTarea(t.id)}
className="rounded-full border border-dashed border-slate-400 px-2.5 py-0.5 text-xs text-slate-600 transition hover:border-marca-400 hover:bg-marca-50 hover:text-marca-700"
            >
              + {esAprendizaje ? 'Nueva práctica' : 'Nueva tarea'}
            </button>
          </div>
        )}

        {/* Sub-subtemas (3er nivel) */}
        {t.subtemas.length > 0 && (
          <ul className="mt-2 space-y-0.5 pl-6">
            {t.subtemas.map((sub) => {
              const subReal = subtemaReal(sub.id)
              return (
                <li
                  key={sub.id}
                  onDragOver={(e) => {
                    if (arrastrando?.nivel !== 'sub' || arrastrando.tId !== t.id) return
                    e.preventDefault()
                    setSobre(sub.id)
                  }}
                  onDragLeave={() => setSobre((x) => (x === sub.id ? null : x))}
                  onDrop={(e) => {
                    e.preventDefault()
                    soltarSub(u.id, t.id, sub.id)
                  }}
                  className={`rounded-md border transition ${
                    sobre === sub.id && arrastrando?.nivel === 'sub'
                      ? 'border-marca-400 ring-2 ring-marca-100'
                      : 'border-transparent'
                  } ${arrastrando?.id === sub.id ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    {asaArrastre({ nivel: 'sub', uId: u.id, tId: t.id, id: sub.id }, `este ${N3}`)}
                    {inputTitulo(sub.titulo, sub.id, (v) => setTitulo(3, [u.id, t.id, sub.id], v), `Título del ${N3}`, 'flex-1 text-slate-700')}
                    <button
                      onClick={() => pedirQuitarSub(u.id, t.id, sub)}
                      title={`Quitar ${N3}`}
                      className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Conceptos del subtema: el material también se engancha
                      en el nivel más fino, no sólo en el intermedio. */}
                  {subReal && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-6">
                      <span className="w-16 shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        Conceptos
                      </span>
                      {subReal.conceptos.map((cid) => (
                        <ChipConcepto
                          key={cid}
                          concepto={conceptoPorId.get(cid)}
                          conceptoId={cid}
                          onAbrir={() => abrirVistazo(cid)}
                          onQuitar={() => onDesvincular(sub.id, cid)}
                          onCrearTarea={() => onCrearTarea(t.id, cid)}
                          etiquetaTarea={esAprendizaje ? 'Nueva práctica' : 'Nueva tarea'}
                        />
                      ))}
                      <span className="relative">
                        <button
                          onClick={() => setTemaBuscador((a) => (a === sub.id ? null : sub.id))}
className="rounded-full border border-dashed border-slate-400 px-2.5 py-0.5 text-xs text-slate-600 transition hover:border-marca-400 hover:bg-marca-50 hover:text-marca-700"
                        >
                          + Vincular concepto
                        </button>
                        {temaBuscador === sub.id && (
                          <BuscadorConceptos
                            excluir={subReal.conceptos}
                            onSeleccionar={(cid) => {
                              onVincular(sub.id, cid)
                              setTemaBuscador(null)
                            }}
                            onCerrar={() => setTemaBuscador(null)}
                          />
                        )}
                      </span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <button onClick={() => addSub(u.id, t.id)} className="mt-1.5 pl-2 text-xs text-marca-600 hover:text-marca-700">
          + Agregar {N3}
        </button>
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-4">
      {/* Estado del autosave (aparece solo al guardar; sin avisos intrusivos). */}
      <div className="flex h-4 items-center justify-end text-xs">
        {guardando ? (
          <span className="text-slate-400">Guardando…</span>
        ) : guardado ? (
          <span className="text-emerald-600">✓ Guardado</span>
        ) : null}
      </div>

      {/* Con muchas unidades y temas la lista se hace larguísima; esto da una
          vista de conjunto de un clic. */}
      {arbol.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() =>
              setCerrados((s) =>
                s.size > 0
                  ? new Set()
                  : new Set(arbol.flatMap((u) => [u.id, ...u.temas.map((x) => x.id)]))
              )
            }
            className="text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            {cerrados.size > 0 ? 'Desplegar todo' : 'Plegar todo'}
          </button>
        </div>
      )}

      {esAprendizaje ? (
        // Aplanado: el espacio YA ES el tema que se quiere aprender, así que sus
        // temas cuelgan directos. El contenedor de la capa curricular sigue
        // existiendo por debajo (una unidad implícita), pero no se pide ni se ve.
        <ul className="space-y-2">{arbol.flatMap((u) => u.temas.map((t) => filaTema(u, t)))}</ul>
      ) : (
        arbol.map((u) => (
        <div
          key={u.id}
          onDragOver={(e) => {
            if (arrastrando?.nivel !== 'unidad') return
            e.preventDefault()
            setSobre(u.id)
          }}
          onDragLeave={() => setSobre((x) => (x === u.id ? null : x))}
          onDrop={(e) => {
            e.preventDefault()
            soltarUnidad(u.id)
          }}
          className={`rounded-xl border p-4 transition ${
            sobre === u.id && arrastrando?.nivel === 'unidad'
              ? 'border-marca-400 ring-2 ring-marca-100'
              : 'border-slate-200'
          } ${arrastrando?.id === u.id ? 'opacity-50' : ''}`}
        >
          <div className="mb-2 flex items-center gap-1">
            {asaArrastre({ nivel: 'unidad', uId: u.id, id: u.id }, `esta ${N1}`)}
            <button
              onClick={() => alternarPlegado(u.id)}
              title={plegado(u.id) ? `Desplegar ${N1}` : `Plegar ${N1}`}
              aria-expanded={!plegado(u.id)}
              className="shrink-0 rounded px-1 text-slate-500 transition hover:text-slate-800"
            >
              {plegado(u.id) ? '▸' : '▾'}
            </button>
            {inputTitulo(u.titulo, u.id, (v) => setTitulo(1, [u.id], v), `Título del ${N1} (ej. Fundamentos)`, 'flex-1 font-medium text-slate-800')}
            {plegado(u.id) && (
              // Plegada, el recuento es lo único que dice qué hay dentro.
              <span className="shrink-0 px-1 text-xs text-slate-500">
                {u.temas.length} {u.temas.length === 1 ? N2.toLowerCase() : `${N2.toLowerCase()}s`}
              </span>
            )}
            <button
              onClick={() => pedirQuitarUnidad(u)}
              title={`Quitar ${N1}`}
              className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-red-50 hover:text-red-600"
            >
              ✕
            </button>
          </div>

          <ul className={`space-y-2 pl-3 ${plegado(u.id) ? 'hidden' : ''}`}>
            {u.temas.map((t) => filaTema(u, t))}
          </ul>

          <button onClick={() => addTema(u.id)} className="mt-3 pl-3 text-sm text-marca-600 hover:text-marca-700">
            + Agregar {N2}
          </button>
        </div>
        ))
      )}

      <button
        onClick={esAprendizaje ? addTemaSuelto : addUnidad}
        className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-sm text-slate-500 hover:border-marca-300 hover:text-marca-700"
      >
        + Agregar {esAprendizaje ? N2 : N1}
      </button>

      {menu && (
        <MenuContextual
          x={menu.x}
          y={menu.y}
          onCerrar={cerrarMenu}
          opciones={[
            // Sin nivel superior visible no hay "otra unidad" a la que mover.
            ...(esAprendizaje
              ? []
              : [
            {
              etiqueta: `Mover a otra ${N1.toLowerCase()}…`,
              icono: '→',
              // Un tema aún sin guardar no tiene id real que mover.
              deshabilitada: esTmp(menu.dato.tema.id) || arbol.length < 2,
              motivo: esTmp(menu.dato.tema.id)
                ? 'Guarda los cambios antes de moverlo.'
                : `Solo hay una ${N1.toLowerCase()}.`,
              onElegir: () => setMoviendo(menu.dato)
            }
                ]),
            {
              etiqueta: 'Eliminar',
              icono: '✕',
              destructiva: true,
              onElegir: () => pedirQuitarTema(menu.dato.unidadId, menu.dato.tema)
            }
          ]}
        />
      )}

      {moviendo && (
        <DialogoMover
          titulo={`Mover ${N2.toLowerCase()} a otra ${N1.toLowerCase()}`}
          queSeMueve={moviendo.tema.titulo || `este ${N2.toLowerCase()}`}
          destinos={arbol
            .filter((u) => !esTmp(u.id))
            .map((u) => ({
              id: u.id,
              titulo: u.titulo || `(${N1.toLowerCase()} sin título)`,
              detalle: `${u.temas.length} ${u.temas.length === 1 ? N2.toLowerCase() : `${N2.toLowerCase()}s`}`,
              actual: u.id === moviendo.unidadId
            }))}
          textoVacio={`Crea otra ${N1.toLowerCase()} para poder mover aquí.`}
          onMover={async (destinoId) => {
            try {
              const actualizada = await api.moverTema(asignatura.id, moviendo.tema.id, destinoId)
              setArbol(desdeAsignatura(actualizada))
            } catch (error) {
              notificarError(error)
            }
          }}
          onCerrar={() => setMoviendo(null)}
        />
      )}

      {aEliminar && (
        <DialogoConfirmacion
          titulo={`¿Eliminar «${aEliminar.titulo}»?`}
          mensaje={aEliminar.mensaje}
          textoConfirmar="Eliminar"
          onConfirmar={confirmarEliminar}
          onCancelar={() => setAEliminar(null)}
        />
      )}
    </div>
  )
}

/**
 * Concepto vinculado a un tema.
 *
 * El nombre no es solo una etiqueta: abre el panel lateral del concepto, donde
 * está su material. Así, preparar un tema —ver qué tengo, arrastrar un PDF,
 * guardar un enlace— se hace sin abandonar la asignatura, y el material sigue
 * viviendo en el concepto, que es lo que permite reutilizarlo.
 *
 * El contador dice cuánto material tiene (archivos + enlaces). En ámbar cuando
 * está a cero: es justo el tema al que hay que ponerle algo antes de la clase.
 */
function ChipConcepto({
  concepto,
  conceptoId,
  onAbrir,
  onQuitar,
  onCrearTarea,
  etiquetaTarea
}: {
  concepto: ResumenConceptoDTO | undefined
  conceptoId: string
  onAbrir: () => void
  onQuitar: () => void
  /**
   * Crear una tarea/práctica de ESTE concepto. No se crea sola al vincular: un
   * concepto se vincula para decir «esto se estudia aquí», que no siempre
   * significa «y quiero ejercicio». Vincular tres dejaría tres prácticas vacías
   * que hay que borrar. Se ofrece, y se decide.
   */
  onCrearTarea?: () => void
  etiquetaTarea?: string
}): JSX.Element {
  const nombre = concepto?.nombre ?? conceptoId
  const total = concepto ? concepto.totalRecursos + concepto.totalEnlaces : 0
  return (
    <span className="flex items-center gap-1 rounded-full bg-marca-50 py-0.5 pl-2.5 pr-1 text-xs text-marca-700">
      <button
        onClick={onAbrir}
        title={`Ver el material de «${nombre}»`}
        className="flex items-center gap-1.5 rounded-full transition hover:underline"
      >
        {nombre}
        <span
          aria-label={
            total === 0 ? 'Sin material todavía' : `${total} materiales`
          }
          className={`rounded-full px-1.5 text-[10px] font-semibold ${
            total === 0 ? 'bg-amber-100 text-amber-800' : 'bg-marca-100 text-marca-700'
          }`}
        >
          📎 {total}
        </span>
      </button>
      {onCrearTarea && (
        <button
          onClick={onCrearTarea}
          title={`${etiquetaTarea} de «${nombre}»`}
          aria-label={`${etiquetaTarea} de ${nombre}`}
          className="text-marca-400 transition hover:text-marca-700"
        >
          ＋
        </button>
      )}
      <button
        onClick={onQuitar}
        className="text-marca-400 hover:text-red-600"
        aria-label={`Desvincular ${nombre}`}
      >
        ✕
      </button>
    </span>
  )
}
