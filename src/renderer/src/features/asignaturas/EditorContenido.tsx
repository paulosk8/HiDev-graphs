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

/**
 * Acciones que solo aparecen al pasar el ratón por su fila (o al llegar a
 * ellas con el teclado). En reposo la pantalla es contenido; las herramientas
 * salen cuando se van a usar.
 *
 * Van escritas enteras y no compuestas con plantillas: Tailwind busca las
 * clases como texto en el fuente y no vería `group-hover/${x}:opacity-100`.
 */
const AL_PASAR = {
  uni: 'opacity-0 transition focus:opacity-100 group-hover/uni:opacity-100 group-focus-within/uni:opacity-100',
  tema: 'opacity-0 transition focus:opacity-100 group-hover/tema:opacity-100 group-focus-within/tema:opacity-100',
  sub: 'opacity-0 transition focus:opacity-100 group-hover/sub:opacity-100 group-focus-within/sub:opacity-100'
} as const

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
  /**
   * Menús de la unidad y del botón «＋» de un tema. Van aparte del de arriba
   * porque cada uno lleva un dato distinto, y porque el «＋» es el camino
   * rápido (vincular / crear práctica) mientras que el «⋯» es el completo.
   */
  const { menu: menuUni, abrir: abrirMenuUni, cerrar: cerrarMenuUni } = useMenuContextual<UniN>()
  const {
    menu: menuMas,
    abrir: abrirMenuMas,
    cerrar: cerrarMenuMas
  } = useMenuContextual<{ unidadId: string; temaId: string }>()
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
  const plural = (n: number, palabra: string): string => `${n} ${palabra}${n === 1 ? '' : 's'}`

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

  /**
   * Título editable. Se lee como TEXTO, no como campo: un plan de estudios es
   * un documento, y una columna de cajas grises a todo el ancho lo hacía
   * parecer un formulario. El recuadro aparece al pasar el ratón y al
   * enfocarlo, que es cuando de verdad se va a escribir. El aspecto vive en
   * `.titulo-inline` (main.css) porque el modo oscuro pinta el fondo de todos
   * los inputs y aquí hay que dejarlo transparente.
   */
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
      className={`titulo-inline min-w-0 rounded-md border px-1.5 py-0.5 outline-none transition focus:ring-2 focus:ring-marca-100 ${clase}`}
    />
  )

  /** Qué hay dentro de un tema plegado: sin esto, plegarlo lo deja mudo. */
  const resumenTema = (t: TemaN, nConceptos: number, nTareas: number): string =>
    [
      t.subtemas.length ? plural(t.subtemas.length, N3) : '',
      nConceptos ? plural(nConceptos, 'concepto') : '',
      nTareas ? plural(nTareas, esAprendizaje ? 'práctica' : 'tarea') : ''
    ]
      .filter(Boolean)
      .join(' · ')

  /**
   * Fila del tercer nivel. Cuelga del riel de su tema, con canaleta propia
   * para el asa: así su título cae en una vertical distinta de la del tema y
   * la jerarquía se lee sin necesidad de cajas anidadas.
   */
  const filaSub = (u: UniN, t: TemaN, sub: SubN): JSX.Element => {
    const subReal = subtemaReal(sub.id)
    const sinConceptos = !subReal || subReal.conceptos.length === 0
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
        className={`group/sub grid grid-cols-[1.75rem_minmax(0,1fr)] rounded-md py-0.5 transition ${
          sobre === sub.id && arrastrando?.nivel === 'sub' ? 'bg-marca-50 ring-1 ring-marca-400' : ''
        } ${arrastrando?.id === sub.id ? 'opacity-50' : ''}`}
      >
        <div className="col-start-1 row-start-1 flex items-center justify-end pr-1">
          <span className={AL_PASAR.sub}>
            {asaArrastre({ nivel: 'sub', uId: u.id, tId: t.id, id: sub.id }, `este ${N3}`)}
          </span>
        </div>

        <div className="col-start-2 row-start-1 flex min-w-0 items-center gap-1">
          {inputTitulo(
            sub.titulo,
            sub.id,
            (v) => setTitulo(3, [u.id, t.id, sub.id], v),
            `Título del ${N3}`,
            'flex-1 text-[13.5px] text-slate-700'
          )}
          <button
            onClick={() => pedirQuitarSub(u.id, t.id, sub)}
            title={`Quitar ${N3}`}
            aria-label={`Quitar ${sub.titulo || `este ${N3}`}`}
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600 ${AL_PASAR.sub}`}
          >
            ✕
          </button>
        </div>

        {/* Conceptos del subtema: el material también se engancha en el nivel
            más fino, no sólo en el intermedio. */}
        {subReal && (
          <div className="col-start-2 row-start-2 flex flex-wrap items-center gap-1.5 pl-1.5">
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
                title="Vincular un concepto"
                aria-label={`Vincular un concepto a ${sub.titulo || `este ${N3}`}`}
                className={
                  sinConceptos
                    ? 'rounded-md px-1.5 py-0.5 text-xs text-marca-600 transition hover:bg-marca-50 hover:text-marca-700'
                    : `rounded-md px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 ${AL_PASAR.sub}`
                }
              >
                {sinConceptos ? '+ Vincular concepto' : '＋'}
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
  }

  /**
   * Fila de un tema. Vive dentro de su unidad en Docencia y suelta en la
   * lista aplanada de Aprendizaje, así que se pinta desde una función.
   *
   * La rejilla de dos columnas —canaleta + contenido— es lo que ordena la
   * pantalla: el título, sus conceptos, sus prácticas y sus subtemas caen
   * todos en la MISMA vertical, y las herramientas (asa, plegar, opciones)
   * viven fuera de ella. Antes cada tema era una caja gris dentro de otra caja
   * y la jerarquía había que adivinarla.
   */
  const filaTema = (u: UniN, t: TemaN): JSX.Element => {
    const real = temaReal(t.id)
    const tareasTema = tareas.filter((x) => x.temas.includes(t.id))
    const nConceptos = real?.conceptos.length ?? 0
    const sinVinculos = nConceptos === 0 && tareasTema.length === 0
    const resumen = resumenTema(t, nConceptos, tareasTema.length)
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
        className={`group/tema grid grid-cols-[2.25rem_minmax(0,1fr)] rounded-lg py-1.5 transition ${
          sobre === t.id && arrastrando?.nivel === 'tema'
            ? 'bg-marca-50 ring-1 ring-marca-400'
            : 'hover:bg-slate-50'
        } ${arrastrando?.id === t.id ? 'opacity-50' : ''}`}
      >
        {/* Canaleta: reordenar y plegar. El triángulo se queda a la vista
            cuando el tema está plegado; si no, no habría cómo abrirlo. */}
        <div className="col-start-1 row-start-1 flex items-center justify-end gap-0.5 pr-1">
          <span className={AL_PASAR.tema}>
            {asaArrastre({ nivel: 'tema', uId: u.id, id: t.id }, `este ${N2}`)}
          </span>
          <button
            onClick={() => alternarPlegado(t.id)}
            title={plegado(t.id) ? `Desplegar ${N2}` : `Plegar ${N2}`}
            aria-expanded={!plegado(t.id)}
            className={`shrink-0 rounded text-[9px] text-slate-400 transition hover:text-slate-800 ${
              plegado(t.id) ? '' : AL_PASAR.tema
            }`}
          >
            {plegado(t.id) ? '▶' : '▼'}
          </button>
        </div>

        <div className="col-start-2 row-start-1 flex min-w-0 items-center gap-1">
          {inputTitulo(
            t.titulo,
            t.id,
            (v) => setTitulo(2, [u.id, t.id], v),
            `Título del ${N2}`,
            'flex-1 text-[15px] font-medium text-slate-800'
          )}
          {plegado(t.id) && resumen && (
            <span className="shrink-0 whitespace-nowrap px-1 text-xs text-slate-400">{resumen}</span>
          )}
          <button
            onClick={(e) => abrirMenu(e, { unidadId: u.id, tema: t })}
            title={`Opciones de este ${N2}`}
            aria-label={`Opciones de ${t.titulo || `este ${N2}`}`}
            className={`shrink-0 rounded-md px-1.5 py-0.5 leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 ${AL_PASAR.tema}`}
          >
            ⋯
          </button>
        </div>

        <div className={`col-start-2 row-start-2 ${plegado(t.id) ? 'hidden' : ''}`}>
          {/* Todo lo que cuelga del tema, en UNA línea: los conceptos (lo que
              se enseña, con su material) y las prácticas (lo que se pide). Se
              distinguen por forma y color, no por una etiqueta repetida en
              cada fila. Solo para temas guardados: uno recién escrito todavía
              no tiene id al que colgar nada. */}
          {real && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 pl-1.5">
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
              {tareasTema.map((x) => (
                <ChipTarea key={x.id} titulo={x.titulo} onAbrir={() => onAbrirTarea(x.id)} />
              ))}
              <span className="relative">
                {/* Con el tema vacío el camino se enseña escrito —vincular un
                    concepto es lo primero que hay que hacer—; una vez hay algo,
                    basta un «＋» que no compita con lo que ya cuelga. */}
                {sinVinculos ? (
                  <button
                    onClick={() => setTemaBuscador((a) => (a === t.id ? null : t.id))}
                    className="rounded-md px-1.5 py-0.5 text-xs text-marca-600 transition hover:bg-marca-50 hover:text-marca-700"
                  >
                    + Vincular concepto
                  </button>
                ) : (
                  <button
                    onClick={(e) => abrirMenuMas(e, { unidadId: u.id, temaId: t.id })}
                    title={`Agregar a este ${N2}`}
                    aria-label={`Agregar a ${t.titulo || `este ${N2}`}`}
                    className={`rounded-md px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 ${AL_PASAR.tema}`}
                  >
                    ＋
                  </button>
                )}
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

          {t.subtemas.length > 0 && (
            <ul className="ml-1.5 mt-0.5 border-l border-slate-200">
              {t.subtemas.map((sub) => filaSub(u, t, sub))}
            </ul>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-5">
      {/* Barra de la vista: el aviso de guardado y el plegado de conjunto, en
          una sola línea (antes eran dos, alineadas a la derecha, y parecían un
          error de maquetación). */}
      <div className="flex h-5 items-center justify-end gap-4 text-xs">
        {guardando ? (
          <span className="text-slate-400">Guardando…</span>
        ) : guardado ? (
          <span className="text-emerald-600">✓ Guardado</span>
        ) : null}
        {arbol.length > 0 && (
          <button
            onClick={() =>
              setCerrados((s) =>
                s.size > 0
                  ? new Set()
                  : new Set(arbol.flatMap((u) => [u.id, ...u.temas.map((x) => x.id)]))
              )
            }
            className="text-slate-400 underline-offset-2 transition hover:text-slate-700 hover:underline"
          >
            {cerrados.size > 0 ? 'Desplegar todo' : 'Plegar todo'}
          </button>
        )}
      </div>

      {esAprendizaje ? (
        // Aplanado: el espacio YA ES el tema que se quiere aprender, así que sus
        // temas cuelgan directos. El contenedor de la capa curricular sigue
        // existiendo por debajo (una unidad implícita), pero no se pide ni se ve.
        <ul>{arbol.flatMap((u) => u.temas.map((t) => filaTema(u, t)))}</ul>
      ) : (
        arbol.map((u, iU) => (
        <section
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
          className={`group/uni rounded-lg px-1 pb-1 transition ${
            sobre === u.id && arrastrando?.nivel === 'unidad' ? 'bg-marca-50 ring-1 ring-marca-400' : ''
          } ${arrastrando?.id === u.id ? 'opacity-50' : ''}`}
        >
          {/* Cabecera de sección: número, título y qué contiene. La regla de
              abajo es lo único que la separa de sus temas; sin caja, la
              jerarquía la marcan el peso tipográfico y el riel. */}
          <header className="flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
            <span className={`flex shrink-0 items-center ${AL_PASAR.uni}`}>
              {asaArrastre({ nivel: 'unidad', uId: u.id, id: u.id }, `esta ${N1}`)}
            </span>
            <button
              onClick={() => alternarPlegado(u.id)}
              title={plegado(u.id) ? `Desplegar ${N1}` : `Plegar ${N1}`}
              aria-expanded={!plegado(u.id)}
              className="shrink-0 rounded text-[9px] text-slate-400 transition hover:text-slate-800"
            >
              {plegado(u.id) ? '▶' : '▼'}
            </button>
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {N1} {iU + 1}
            </span>
            {inputTitulo(
              u.titulo,
              u.id,
              (v) => setTitulo(1, [u.id], v),
              `Título del ${N1} (ej. Fundamentos)`,
              'flex-1 text-[15px] font-semibold text-slate-900'
            )}
            <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">
              {plural(u.temas.length, N2)}
            </span>
            <button
              onClick={(e) => abrirMenuUni(e, u)}
              title={`Opciones de esta ${N1}`}
              aria-label={`Opciones de ${u.titulo || `esta ${N1}`}`}
              className={`shrink-0 rounded-md px-1.5 py-0.5 leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 ${AL_PASAR.uni}`}
            >
              ⋯
            </button>
          </header>

          <ul className={`ml-2 mt-1 border-l border-slate-200 ${plegado(u.id) ? 'hidden' : ''}`}>
            {u.temas.map((t) => filaTema(u, t))}
          </ul>

          <button
            onClick={() => addTema(u.id)}
            className={`ml-2 rounded px-2 py-1 text-xs text-slate-400 transition hover:text-marca-700 ${
              plegado(u.id) ? 'hidden' : ''
            }`}
          >
            + {N2}
          </button>
        </section>
        ))
      )}

      <button
        onClick={esAprendizaje ? addTemaSuelto : addUnidad}
        className="w-full rounded-lg border border-dashed border-slate-200 py-2 text-sm text-slate-400 transition hover:border-marca-300 hover:text-marca-700"
      >
        + Agregar {esAprendizaje ? N2 : N1}
      </button>

      {menu && (
        <MenuContextual
          x={menu.x}
          y={menu.y}
          onCerrar={cerrarMenu}
          opciones={[
            // El menú completo del tema: nada vive solo en el clic derecho, y
            // nada de lo que se puede hacer desaparece al esconder las
            // acciones de la fila.
            {
              etiqueta: 'Vincular concepto…',
              icono: '◆',
              deshabilitada: esTmp(menu.dato.tema.id),
              motivo: 'Escribe el título y sal del campo para guardarlo.',
              onElegir: () => setTemaBuscador(menu.dato.tema.id)
            },
            {
              etiqueta: esAprendizaje ? 'Nueva práctica…' : 'Nueva tarea…',
              icono: '✎',
              deshabilitada: esTmp(menu.dato.tema.id),
              motivo: 'Escribe el título y sal del campo para guardarlo.',
              onElegir: () => onCrearTarea(menu.dato.tema.id)
            },
            {
              etiqueta: `Agregar ${N3}`,
              icono: '＋',
              onElegir: () => addSub(menu.dato.unidadId, menu.dato.tema.id)
            },
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

      {menuUni && (
        <MenuContextual
          x={menuUni.x}
          y={menuUni.y}
          onCerrar={cerrarMenuUni}
          opciones={[
            {
              etiqueta: `Agregar ${N2}`,
              icono: '＋',
              onElegir: () => addTema(menuUni.dato.id)
            },
            {
              etiqueta: 'Eliminar',
              icono: '✕',
              destructiva: true,
              onElegir: () => pedirQuitarUnidad(menuUni.dato)
            }
          ]}
        />
      )}

      {menuMas && (
        <MenuContextual
          x={menuMas.x}
          y={menuMas.y}
          onCerrar={cerrarMenuMas}
          opciones={[
            {
              etiqueta: 'Vincular concepto…',
              icono: '◆',
              onElegir: () => setTemaBuscador(menuMas.dato.temaId)
            },
            {
              etiqueta: esAprendizaje ? 'Nueva práctica…' : 'Nueva tarea…',
              icono: '✎',
              onElegir: () => onCrearTarea(menuMas.dato.temaId)
            },
            {
              etiqueta: `Agregar ${N3}`,
              icono: '＋',
              onElegir: () => addSub(menuMas.dato.unidadId, menuMas.dato.temaId)
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
 * Cuánto material tiene se dice con el mínimo de tinta: un número apagado si
 * lo hay, y un punto ámbar si NO lo hay, que es el único caso que pide hacer
 * algo. Antes la cuenta iba en una insignia naranja con un clip, encendida
 * incluso cuando no había nada que atender, y competía con el propio nombre.
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
    <span className="chip-concepto group/chip flex max-w-full items-center gap-1 rounded-md border py-0.5 pl-2 pr-1 text-xs">
      <button
        onClick={onAbrir}
        title={
          total === 0
            ? `«${nombre}» todavía no tiene material. Ábrelo para agregarlo.`
            : `${total} materiales en «${nombre}». Ábrelo para verlos.`
        }
        className="flex min-w-0 items-center gap-1.5 transition hover:underline"
      >
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rotate-45 rounded-[1px] bg-current opacity-60" />
        <span className="truncate">{nombre}</span>
        {total === 0 ? (
          <span
            aria-label="Sin material todavía"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
          />
        ) : (
          <span aria-label={`${total} materiales`} className="shrink-0 text-[10px] opacity-60">
            {total}
          </span>
        )}
      </button>
      {/* Las dos acciones del chip ocupan su sitio siempre (así nada se mueve
          al pasar por encima) pero solo se ven cuando el ratón está en él. */}
      {onCrearTarea && (
        <button
          onClick={onCrearTarea}
          title={`${etiquetaTarea} de «${nombre}»`}
          aria-label={`${etiquetaTarea} de ${nombre}`}
          className="shrink-0 opacity-0 transition focus:opacity-100 group-hover/chip:opacity-100"
        >
          ＋
        </button>
      )}
      <button
        onClick={onQuitar}
        className="shrink-0 opacity-0 transition hover:text-red-600 focus:opacity-100 group-hover/chip:opacity-100"
        aria-label={`Desvincular ${nombre}`}
      >
        ✕
      </button>
    </span>
  )
}

/**
 * Práctica o tarea colgada de un tema. Va en la misma línea que los conceptos
 * —es lo otro que cuelga del tema— pero en neutro y con un lápiz por delante:
 * el concepto es lo que se enseña y lleva el color de marca; la práctica es
 * algo que tú escribiste. En ámbar competía con el aviso de «sin material»,
 * que es el único sitio donde ese color debe significar «atiéndeme».
 */
function ChipTarea({ titulo, onAbrir }: { titulo: string; onAbrir: () => void }): JSX.Element {
  return (
    <button
      onClick={onAbrir}
      title={`Abrir «${titulo}»`}
      className="chip-tarea flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition"
    >
      <span aria-hidden className="shrink-0 opacity-60">
        ✎
      </span>
      <span className="truncate">{titulo}</span>
    </button>
  )
}
