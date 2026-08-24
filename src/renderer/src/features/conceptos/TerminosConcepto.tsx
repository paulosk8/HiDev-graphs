import { useEffect, useRef, useState } from 'react'
import type { ConceptoDTO, TerminoDTO } from '@shared/dtos'
import { DialogoConfirmacion } from '../../components/DialogoConfirmacion'
import { MenuContextual, useMenuContextual } from '../../components/MenuContextual'
import { api } from '../../lib/api'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'

/** Clave de comparación: «Prop» y «prop» son el mismo término. */
function clave(texto: string): string {
  return texto
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** A partir de aquí la lista se pliega sola: en el panel lateral no cabe más. */
const PLEGAR_DESDE = 6

interface Props {
  concepto: ConceptoDTO
  /** Devuelve el concepto ya actualizado por el proceso principal. */
  onActualizado: (concepto: ConceptoDTO) => void
  /** En el panel lateral todo va más apretado que en la ficha. */
  compacto?: boolean
}

/**
 * Glosario del concepto: términos con su definición corta.
 *
 * Decisiones de uso, que son las que hacen que un glosario se llegue a llenar:
 *  - **Entrada en cadena**: los términos se vuelcan de ocho en ocho, no de uno
 *    en uno. Enter en la definición guarda y deja otra fila lista con el foco.
 *  - **Edición donde está**: pulsar una fila la abre en su sitio, sin modal.
 *  - **Duplicado avisado, no bloqueado**: a quien está escribiendo no se le
 *    para; se le enseña el que ya existe.
 *  - **Texto plano a propósito**: si necesita formato o código, eso es una
 *    nota. La forma fija es lo que permite consultarlo y, más adelante,
 *    exportarlo como glosario para el estudiante.
 */
export function TerminosConcepto({ concepto, onActualizado, compacto = false }: Props): JSX.Element {
  const notificarError = useUiStore((s) => s.notificarError)
  // Sin esto, buscar por un término recién escrito no lo encontraría hasta que
  // el observador del vault refrescara el listado.
  const reflejarConcepto = useConceptosStore((s) => s.reflejarConcepto)
  const { menu, abrir: abrirMenu, cerrar: cerrarMenu } = useMenuContextual<TerminoDTO>()

  /** Id en edición, 'nuevo' para la fila de alta, o null. */
  const [editando, setEditando] = useState<string | 'nuevo' | null>(null)
  const [termino, setTermino] = useState('')
  const [definicion, setDefinicion] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aEliminar, setAEliminar] = useState<TerminoDTO | null>(null)
  const [plegado, setPlegado] = useState(true)
  const campoTermino = useRef<HTMLInputElement>(null)

  // Un glosario se consulta, no se narra: alfabético.
  const lista = [...concepto.terminos].sort((a, b) => a.termino.localeCompare(b.termino, 'es'))
  const visibles = plegado && lista.length > PLEGAR_DESDE ? lista.slice(0, PLEGAR_DESDE) : lista

  /** El que ya existe con ese nombre (para avisar sin bloquear). */
  const duplicado = lista.find(
    (t) => t.id !== editando && clave(t.termino) === clave(termino) && clave(termino).length > 0
  )

  useEffect(() => {
    if (editando === 'nuevo') campoTermino.current?.focus()
  }, [editando])

  const abrirNuevo = (): void => {
    setTermino('')
    setDefinicion('')
    setEditando('nuevo')
  }
  const abrirEdicion = (t: TerminoDTO): void => {
    setTermino(t.termino)
    setDefinicion(t.definicion)
    setEditando(t.id)
  }
  const cerrarEdicion = (): void => {
    setEditando(null)
    setTermino('')
    setDefinicion('')
  }

  const guardar = async (seguirAgregando: boolean): Promise<void> => {
    if (!termino.trim() || !definicion.trim() || ocupado) return
    setOcupado(true)
    try {
      const datos = { termino, definicion }
      const actualizado =
        editando === 'nuevo'
          ? await api.agregarTermino(concepto.id, datos)
          : await api.editarTermino(concepto.id, editando as string, datos)
      onActualizado(actualizado)
      reflejarConcepto(actualizado)
      // Volcar términos es una ráfaga: se deja otra fila lista, no la lista.
      if (seguirAgregando && editando === 'nuevo') {
        setTermino('')
        setDefinicion('')
        setPlegado(false)
        campoTermino.current?.focus()
      } else {
        cerrarEdicion()
      }
    } catch (error) {
      notificarError(error)
    } finally {
      setOcupado(false)
    }
  }

  const eliminar = async (t: TerminoDTO): Promise<void> => {
    try {
      const actualizado = await api.eliminarTermino(concepto.id, t.id)
      onActualizado(actualizado)
      reflejarConcepto(actualizado)
    } catch (error) {
      notificarError(error)
    } finally {
      setAEliminar(null)
    }
  }

  const filaEdicion = (
    <div className="space-y-1.5 rounded-lg border border-marca-200 bg-marca-50/40 p-2.5">
      <input
        ref={campoTermino}
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cerrarEdicion()
        }}
        placeholder="Término"
        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium outline-none focus:border-marca-400 focus:ring-2 focus:ring-marca-100"
      />
      <textarea
        value={definicion}
        onChange={(e) => setDefinicion(e.target.value)}
        onKeyDown={(e) => {
          // Enter guarda y encadena; Mayús+Enter parte la línea si hace falta.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void guardar(true)
          }
          if (e.key === 'Escape') cerrarEdicion()
        }}
        rows={2}
        placeholder="Su definición, en una o dos frases…"
        className="w-full resize-none rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-marca-400 focus:ring-2 focus:ring-marca-100"
      />

      {duplicado && (
        <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Ya tienes «{duplicado.termino}» en este concepto.{' '}
          <button
            onClick={() => abrirEdicion(duplicado)}
            className="font-medium underline underline-offset-2"
          >
            Editar el que ya existe
          </button>
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-400">
          {editando === 'nuevo' ? 'Enter guarda y abre otro · Esc cierra' : 'Enter guarda · Esc cierra'}
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={cerrarEdicion}
            className="rounded-md px-2.5 py-1 text-xs text-slate-500 transition hover:bg-slate-100"
          >
            Cerrar
          </button>
          <button
            onClick={() => void guardar(false)}
            disabled={!termino.trim() || !definicion.trim() || ocupado}
            className="rounded-md bg-marca-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-marca-700 disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <section className={compacto ? 'mt-5' : 'mb-8'}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Términos y definiciones
          {lista.length > 0 && <span className="ml-1 font-normal">({lista.length})</span>}
        </h2>
        {editando !== 'nuevo' && (
          <button
            onClick={abrirNuevo}
            className="rounded-md px-2 py-1 text-xs font-medium text-marca-600 transition hover:bg-marca-50 hover:text-marca-700"
          >
            + Agregar término
          </button>
        )}
      </div>

      {lista.length === 0 && editando === null ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-400">
          Un glosario para las palabras que aparecen en este material. Se consulta desde aquí y
          también las encuentra el buscador de conceptos.
        </p>
      ) : (
        <ul className="space-y-1">
          {visibles.map((t) =>
            editando === t.id ? (
              <li key={t.id}>{filaEdicion}</li>
            ) : (
              <li
                key={t.id}
                onContextMenu={(e) => abrirMenu(e, t)}
                className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
              >
                <button
                  onClick={() => abrirEdicion(t)}
                  title="Editar este término"
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="text-sm font-medium text-slate-800">{t.termino}</span>{' '}
                  <span className="text-sm text-slate-500">{t.definicion}</span>
                </button>
                {/* Visible siempre en el foco del teclado y al pasar por encima:
                    ninguna acción vive solo en el clic derecho. */}
                <button
                  onClick={(e) => abrirMenu(e, t)}
                  aria-label={`Opciones de ${t.termino}`}
                  className="shrink-0 rounded px-1.5 text-slate-300 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 focus:opacity-100 group-hover:opacity-100"
                >
                  ⋯
                </button>
              </li>
            )
          )}
        </ul>
      )}

      {lista.length > PLEGAR_DESDE && (
        <button
          onClick={() => setPlegado((p) => !p)}
          className="mt-1 px-2 text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          {plegado ? `Ver los ${lista.length} términos` : 'Ver menos'}
        </button>
      )}

      {editando === 'nuevo' && <div className="mt-1.5">{filaEdicion}</div>}

      {menu && (
        <MenuContextual
          x={menu.x}
          y={menu.y}
          onCerrar={cerrarMenu}
          opciones={[
            { etiqueta: 'Editar', icono: '✎', onElegir: () => abrirEdicion(menu.dato) },
            {
              etiqueta: 'Eliminar',
              icono: '✕',
              destructiva: true,
              onElegir: () => setAEliminar(menu.dato)
            }
          ]}
        />
      )}

      {aEliminar && (
        <DialogoConfirmacion
          titulo={`¿Eliminar «${aEliminar.termino}»?`}
          mensaje="Se quita del glosario de este concepto. El resto del material no se toca."
          onConfirmar={() => eliminar(aEliminar)}
          onCancelar={() => setAEliminar(null)}
        />
      )}
    </section>
  )
}
