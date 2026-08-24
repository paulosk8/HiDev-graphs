import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ConceptoDTO, EtiquetaDTO } from '@shared/dtos'
import { api } from '../../lib/api'
import { claveEtiqueta, limpiarEtiqueta } from '../../lib/etiquetas'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'

interface Props {
  concepto: ConceptoDTO
  /** Devuelve el concepto ya con sus etiquetas nuevas. */
  onActualizado: (concepto: ConceptoDTO) => void
  /**
   * Si se pasa, el texto de la etiqueta filtra el listado al pulsarlo. En el
   * panel lateral no se pasa: filtrar te sacaría de donde estabas mirando.
   */
  alFiltrar?: (etiqueta: string) => void
}

/**
 * Etiquetas del concepto, editables donde se ven.
 *
 * Antes solo se podían tocar abriendo «Editar», y ese viaje —modal, cambiar,
 * guardar, volver— es demasiado para añadir una palabra. Aquí se escriben como
 * los términos del glosario: Enter guarda y deja el campo listo para la
 * siguiente.
 *
 * Se sugieren las que el docente YA usa, y por eso el campo pide una lista al
 * abrirse: sin sugerencias cada ficha acaba con su propia variante de la misma
 * idea ("parcial", "primer parcial", "parcial 1") y el filtro deja de servir.
 */
export function EtiquetasConcepto({ concepto, onActualizado, alFiltrar }: Props): JSX.Element {
  const notificarError = useUiStore((s) => s.notificarError)
  const reflejarConcepto = useConceptosStore((s) => s.reflejarConcepto)

  const [escribiendo, setEscribiendo] = useState(false)
  const [texto, setTexto] = useState('')
  const [conocidas, setConocidas] = useState<EtiquetaDTO[]>([])
  const [ocupado, setOcupado] = useState(false)
  /** Etiqueta que ya tiene el concepto, cuando se intenta repetir. */
  const [repetida, setRepetida] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!escribiendo) return
    inputRef.current?.focus()
    void api
      .listarEtiquetas()
      .then(setConocidas)
      .catch(() => setConocidas([]))
  }, [escribiendo])

  const guardar = async (etiquetas: string[]): Promise<void> => {
    setOcupado(true)
    try {
      // El nombre y la descripción viajan tal cual: la edición conserva lo
      // demás (notas, glosario, material) porque no lo manda.
      const resumen = await api.editarConcepto(concepto.id, {
        nombre: concepto.nombre,
        descripcion: concepto.descripcion,
        etiquetas
      })
      // El dominio las normaliza al guardar; se pinta lo que él devolvió.
      const actualizado = { ...concepto, etiquetas: resumen.etiquetas }
      onActualizado(actualizado)
      reflejarConcepto(actualizado)
    } catch (error) {
      notificarError(error)
    } finally {
      setOcupado(false)
    }
  }

  const agregar = async (bruta: string): Promise<void> => {
    const etiqueta = limpiarEtiqueta(bruta)
    if (!etiqueta) return
    const ya = concepto.etiquetas.find((e) => claveEtiqueta(e) === claveEtiqueta(etiqueta))
    if (ya) {
      // Nada falla en silencio: se dice cuál ya está y se limpia el campo.
      setRepetida(ya)
      setTexto('')
      return
    }
    setRepetida(null)
    setTexto('')
    await guardar([...concepto.etiquetas, etiqueta])
    inputRef.current?.focus()
  }

  const quitar = async (etiqueta: string): Promise<void> => {
    await guardar(concepto.etiquetas.filter((e) => claveEtiqueta(e) !== claveEtiqueta(etiqueta)))
  }

  const alTeclear = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (texto.trim()) {
        e.preventDefault()
        void agregar(texto)
      }
      return
    }
    if (e.key === 'Escape') {
      setEscribiendo(false)
      setTexto('')
      setRepetida(null)
      return
    }
    // Retroceso con el campo vacío quita la última, como en cualquier buscador.
    if (e.key === 'Backspace' && !texto && concepto.etiquetas.length > 0) {
      void quitar(concepto.etiquetas[concepto.etiquetas.length - 1])
    }
  }

  const sugerencias = useMemo(() => {
    const puestas = new Set(concepto.etiquetas.map(claveEtiqueta))
    const buscado = claveEtiqueta(texto)
    return conocidas
      .filter((c) => !puestas.has(claveEtiqueta(c.etiqueta)))
      .filter((c) => !buscado || claveEtiqueta(c.etiqueta).includes(buscado))
      .slice(0, 6)
  }, [conocidas, concepto.etiquetas, texto])

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {concepto.etiquetas.map((e) => (
        <span
          key={e}
          className="inline-flex items-center gap-1 rounded-full bg-marca-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-marca-700"
        >
          {alFiltrar ? (
            <button
              onClick={() => alFiltrar(e)}
              title={`Ver todo lo etiquetado como «${e}»`}
              className="transition hover:underline"
            >
              {e}
            </button>
          ) : (
            e
          )}
          <button
            onClick={() => void quitar(e)}
            disabled={ocupado}
            aria-label={`Quitar la etiqueta ${e}`}
            className="text-marca-400 transition hover:text-red-600 disabled:opacity-40"
          >
            ✕
          </button>
        </span>
      ))}

      {escribiendo ? (
        <span className="relative inline-flex items-center">
          <input
            ref={inputRef}
            value={texto}
            onChange={(ev) => {
              setTexto(ev.target.value)
              setRepetida(null)
            }}
            onKeyDown={alTeclear}
            onBlur={() => {
              if (texto.trim()) void agregar(texto)
              else setEscribiendo(false)
            }}
            placeholder="Etiqueta…"
            maxLength={40}
            disabled={ocupado}
            className="w-32 rounded-full border border-marca-300 bg-white px-2.5 py-0.5 text-xs outline-none focus:ring-2 focus:ring-marca-100"
          />
          {(sugerencias.length > 0 || repetida) && (
            <span className="absolute left-0 top-6 z-20 flex w-56 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
              {repetida && (
                <span className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                  Ya tiene la etiqueta «{repetida}».
                </span>
              )}
              {sugerencias.length > 0 && (
                <>
                  <span className="px-1 text-[10px] uppercase tracking-wide text-slate-400">
                    Ya usas
                  </span>
                  {sugerencias.map((s) => (
                    <button
                      key={s.etiqueta}
                      // onMouseDown: con onClick, el blur del campo se adelanta
                      // y la sugerencia se cierra antes de recibir el clic.
                      onMouseDown={(ev) => {
                        ev.preventDefault()
                        void agregar(s.etiqueta)
                      }}
                      className="flex items-center justify-between rounded px-1.5 py-1 text-left text-xs text-slate-700 transition hover:bg-marca-50 hover:text-marca-700"
                    >
                      {s.etiqueta}
                      <span className="text-slate-400">{s.total}</span>
                    </button>
                  ))}
                </>
              )}
            </span>
          )}
        </span>
      ) : (
        <button
          onClick={() => setEscribiendo(true)}
          className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-500 transition hover:border-marca-300 hover:text-marca-700"
        >
          + Etiqueta
        </button>
      )}
    </div>
  )
}
