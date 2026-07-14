import { useEffect, useState } from 'react'
import type {
  AsignaturaDTO,
  DatosUnidadEdicionDTO,
  ResumenTareaDTO
} from '@shared/dtos'
import { BuscadorConceptos } from '../vinculos/BuscadorConceptos'

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
  nombrePorId: Map<string, string>
  tareas: ResumenTareaDTO[]
  onVincular: (temaId: string, conceptoId: string) => void
  onDesvincular: (temaId: string, conceptoId: string) => void
  onAbrirTarea: (id: string) => void
  onGuardar: (unidades: DatosUnidadEdicionDTO[]) => Promise<void>
}

export function EditorContenido({
  asignatura,
  esAprendizaje,
  nombrePorId,
  tareas,
  onVincular,
  onDesvincular,
  onAbrirTarea,
  onGuardar
}: Props): JSX.Element {
  const [arbol, setArbol] = useState<UniN[]>(() => desdeAsignatura(asignatura))
  const [foco, setFoco] = useState<string | null>(null)
  const [temaBuscador, setTemaBuscador] = useState<string | null>(null)

  // Re-sincroniza el árbol cuando la asignatura cambia (tras guardar o vincular).
  useEffect(() => {
    setArbol(desdeAsignatura(asignatura))
  }, [asignatura])

  // Etiquetas de nivel (inequívocas en cada contexto).
  const N1 = esAprendizaje ? 'bloque' : 'tema'
  const N2 = esAprendizaje ? 'tema' : 'subtema'
  const N3 = esAprendizaje ? 'subtema' : 'sub-subtema'

  const persistir = async (nuevo: UniN[]): Promise<void> => {
    setArbol(nuevo)
    await onGuardar(aDTO(nuevo))
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
    // título vacío y persiste el resto. Evita closures obsoletos al perder el foco.
    setArbol((prev) => {
      const limpio = prev
        .map((u) => ({
          ...u,
          temas: u.temas
            .map((t) => ({ ...t, subtemas: t.subtemas.filter((s) => s.titulo.trim() || !esTmp(s.id)) }))
            .filter((t) => t.titulo.trim() || !esTmp(t.id))
        }))
        .filter((u) => u.titulo.trim() || !esTmp(u.id))
      queueMicrotask(() => void onGuardar(aDTO(limpio)))
      return limpio
    })
  }

  // --- Bajas ---
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

  // Conceptos/tareas del tema (desde la asignatura, por id).
  const temaReal = (tId: string): AsignaturaDTO['unidades'][number]['temas'][number] | undefined =>
    asignatura.unidades.flatMap((u) => u.temas).find((t) => t.id === tId)

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

  return (
    <div className="space-y-4">
      {arbol.map((u) => (
        <div key={u.id} className="rounded-xl border border-slate-200 p-4">
          <div className="mb-2 flex items-center gap-1">
            {inputTitulo(u.titulo, u.id, (v) => setTitulo(1, [u.id], v), `Título del ${N1} (ej. Unidad 1)`, 'flex-1 font-medium text-slate-800')}
            <button
              onClick={() => quitarUnidad(u.id)}
              title={`Quitar ${N1}`}
              className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-300 transition hover:bg-red-50 hover:text-red-600"
            >
              ✕
            </button>
          </div>

          <ul className="space-y-3 pl-3">
            {u.temas.map((t) => {
              const real = temaReal(t.id)
              const tareasTema = tareas.filter((x) => x.temas.includes(t.id))
              return (
                <li key={t.id} className="border-l-2 border-slate-100 pl-3 text-sm">
                  <div className="flex items-center gap-1">
                    {inputTitulo(t.titulo, t.id, (v) => setTitulo(2, [u.id, t.id], v), `Título del ${N2}`, 'flex-1 font-medium text-slate-700')}
                    <button
                      onClick={() => quitarTema(u.id, t.id)}
                      title={`Quitar ${N2}`}
                      className="shrink-0 rounded-md px-2 py-0.5 text-xs text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Conceptos vinculados (puente), solo para temas existentes */}
                  {real && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-2">
                      {real.conceptos.map((cid) => (
                        <span key={cid} className="flex items-center gap-1 rounded-full bg-marca-50 py-0.5 pl-2.5 pr-1 text-xs text-marca-700">
                          {nombrePorId.get(cid) ?? cid}
                          <button onClick={() => onDesvincular(t.id, cid)} className="text-marca-400 hover:text-red-600" aria-label="Quitar concepto">
                            ✕
                          </button>
                        </span>
                      ))}
                      <span className="relative">
                        <button
                          onClick={() => setTemaBuscador((a) => (a === t.id ? null : t.id))}
                          className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-500 hover:border-marca-300 hover:text-marca-700"
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

                  {/* Tareas del tema */}
                  {tareasTema.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-2">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        {esAprendizaje ? 'Prácticas:' : 'Tareas:'}
                      </span>
                      {tareasTema.map((x) => (
                        <button key={x.id} onClick={() => onAbrirTarea(x.id)} className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800 hover:bg-amber-100">
                          {x.titulo}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Sub-subtemas (3er nivel) */}
                  {t.subtemas.length > 0 && (
                    <ul className="mt-2 space-y-1 pl-4">
                      {t.subtemas.map((sub) => (
                        <li key={sub.id} className="flex items-center gap-1">
                          <span className="text-slate-300">·</span>
                          {inputTitulo(sub.titulo, sub.id, (v) => setTitulo(3, [u.id, t.id, sub.id], v), `Título del ${N3}`, 'flex-1 text-slate-600')}
                          <button
                            onClick={() => quitarSub(u.id, t.id, sub.id)}
                            title={`Quitar ${N3}`}
                            className="shrink-0 rounded-md px-2 py-0.5 text-xs text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <button onClick={() => addSub(u.id, t.id)} className="mt-1.5 pl-2 text-xs text-marca-600 hover:text-marca-700">
                    + Agregar {N3}
                  </button>
                </li>
              )
            })}
          </ul>

          <button onClick={() => addTema(u.id)} className="mt-3 pl-3 text-sm text-marca-600 hover:text-marca-700">
            + Agregar {N2}
          </button>
        </div>
      ))}

      <button
        onClick={addUnidad}
        className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-sm text-slate-500 hover:border-marca-300 hover:text-marca-700"
      >
        + Agregar {N1}
      </button>
    </div>
  )
}
