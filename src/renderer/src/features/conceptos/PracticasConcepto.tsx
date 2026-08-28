import { useCallback, useEffect, useState } from 'react'
import type {
  AsignaturaDTO,
  ConceptoDTO,
  ResumenTareaDTO,
  UsoDeConceptoDTO
} from '@shared/dtos'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useUiStore } from '../../stores/uiStore'
import { FichaTarea } from '../tareas/FichaTarea'
import { FormularioTarea } from '../tareas/FormularioTarea'

interface Props {
  concepto: ConceptoDTO
  /** Dónde se usa el concepto: de ahí salen los destinos de una práctica nueva. */
  usos: UsoDeConceptoDTO[]
  /** Versión estrecha, para el panel lateral. */
  compacto?: boolean
}

/**
 * Lo que se PIDE con este concepto: sus prácticas, y el botón para crear otra.
 *
 * Vive junto al material y a las notas porque ese es el momento en que se
 * decide: acabas de subir el PDF y quieres pedir algo con él. Antes el único
 * camino era el «＋» del chip del concepto dentro de la asignatura, que solo
 * está a mano si vienes de ahí.
 *
 * Es un componente propio, y no dos copias, porque lo usan la ficha y el panel
 * lateral —igual que `ZonaMaterial` y `NotasConcepto`—: lo que se arregle aquí
 * llega a los dos sitios.
 *
 * Una práctica cuelga de un tema y un concepto puede usarse en varios, así que
 * el destino se pregunta en vez de suponerlo.
 */
export function PracticasConcepto({ concepto, usos, compacto = false }: Props): JSX.Element {
  const esAprendizaje = useUiStore((s) => s.contexto) === 'aprendizaje'
  const notificarError = useUiStore((s) => s.notificarError)
  const asignaturas = useAsignaturasStore((s) => s.lista)

  const [tareas, setTareas] = useState<ResumenTareaDTO[]>([])
  const [tareaAbierta, setTareaAbierta] = useState<string | null>(null)
  const [creandoEn, setCreandoEn] = useState<{
    asignatura: AsignaturaDTO
    temaId: string
  } | null>(null)
  const [eligiendoUso, setEligiendoUso] = useState(false)
  const [preparando, setPreparando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setTareas(await api.listarTareasDeConcepto(concepto.id))
    } catch {
      /* no bloquea la ficha */
    }
  }, [concepto.id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  /**
   * Dónde puede ir una práctica nueva. Cuelga del tema, así que dos usos del
   * mismo tema (uno por el tema y otro por un subtema suyo) son el mismo
   * destino y se ofrecen una sola vez.
   */
  const destinos = usos.filter(
    (u, i) =>
      usos.findIndex((o) => o.asignaturaId === u.asignaturaId && o.temaId === u.temaId) === i
  )
  const etiqueta = esAprendizaje ? 'práctica' : 'tarea'

  /** Trae la asignatura entera (el formulario la necesita) y abre el formulario. */
  const nueva = async (uso: UsoDeConceptoDTO): Promise<void> => {
    setEligiendoUso(false)
    setPreparando(true)
    try {
      setCreandoEn({ asignatura: await api.obtenerAsignatura(uso.asignaturaId), temaId: uso.temaId })
    } catch (error) {
      notificarError(error)
    } finally {
      setPreparando(false)
    }
  }

  const crear = (): void => {
    const [primero, ...resto] = destinos
    if (!primero) return
    if (resto.length === 0) void nueva(primero)
    else setEligiendoUso(true)
  }

  return (
    <section className={compacto ? 'mt-5' : 'mt-8'}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2
          className={`font-semibold uppercase tracking-wide text-slate-400 ${
            compacto ? 'text-xs' : 'text-sm'
          }`}
        >
          {esAprendizaje ? 'Prácticas' : 'Tareas'} con este concepto
          {tareas.length > 0 && <span className="ml-1 font-normal">({tareas.length})</span>}
        </h2>
        {/* Deshabilitado y con el motivo a la vista: esconderlo dejaría al
            docente preguntándose por qué aquí no puede y en el tema sí. */}
        <button
          onClick={crear}
          disabled={destinos.length === 0 || preparando}
          title={
            destinos.length === 0
              ? `Vincula antes el concepto a un tema: una ${etiqueta} vive dentro de ${
                  esAprendizaje ? 'un espacio de aprendizaje' : 'una asignatura'
                }.`
              : `Nueva ${etiqueta} con «${concepto.nombre}»`
          }
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-marca-600 transition hover:bg-marca-50 hover:text-marca-700 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
        >
          {preparando ? 'Abriendo…' : `+ Nueva ${etiqueta}`}
        </button>
      </div>

      {tareas.length === 0 ? (
        <p
          className={`text-slate-400 ${
            compacto
              ? 'text-xs'
              : 'rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm'
          }`}
        >
          {destinos.length === 0
            ? `Cuando este concepto se use en un tema podrás crear aquí una ${etiqueta} con su material.`
            : `Todavía no hay ninguna ${etiqueta} con este concepto.`}
        </p>
      ) : (
        <ul className={compacto ? 'space-y-1' : 'space-y-2'}>
          {tareas.map((t) => {
            const asig = asignaturas.find((a) => a.id === t.asignaturaId)
            return (
              <li key={t.id}>
                <button
                  onClick={() => setTareaAbierta(t.id)}
                  className={`flex w-full items-center gap-2 rounded-lg border border-slate-200 text-left transition hover:border-marca-300 hover:shadow-sm ${
                    compacto ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
                  }`}
                >
                  <span aria-hidden className="shrink-0 text-slate-400">
                    ✎
                  </span>
                  <span className="flex-1 truncate font-medium text-slate-700">{t.titulo}</span>
                  {asig && !compacto && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {asig.nombre}
                      {asig.periodos.length > 0 && ` · ${asig.periodos.join(', ')}`}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* El concepto puede estar en varios temas y la práctica solo cuelga de
          uno: se pregunta en vez de elegir por él. */}
      {eligiendoUso && (
        <Modal
          titulo={`¿Dónde va esta ${etiqueta}?`}
          descripcion={`«${concepto.nombre}» se usa en varios temas. Elige en cuál se crea; en el formulario puedes cambiarlo.`}
          onCerrar={() => setEligiendoUso(false)}
        >
          <ul className="space-y-2">
            {destinos.map((uso) => (
              <li key={`${uso.asignaturaId}-${uso.temaId}`}>
                <button
                  onClick={() => void nueva(uso)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm transition hover:border-marca-300 hover:shadow-sm"
                >
                  <span className="font-medium text-slate-700">
                    {uso.asignatura}
                    {uso.periodos.length > 0 && ` · ${uso.periodos.join(', ')}`}
                  </span>
                  <span className="text-slate-400"> › </span>
                  <span className="text-slate-600">{uso.tema}</span>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {creandoEn && (
        <FormularioTarea
          asignatura={creandoEn.asignatura}
          temaPreseleccionado={creandoEn.temaId}
          conceptosPreseleccionados={[concepto.id]}
          tituloInicial={`${
            creandoEn.asignatura.tipo === 'aprendizaje' ? 'Práctica' : 'Tarea'
          }: ${concepto.nombre}`}
          onCerrar={() => setCreandoEn(null)}
          onGuardada={(t) => {
            void cargar()
            setTareaAbierta(t.id)
          }}
        />
      )}

      {tareaAbierta && (
        <FichaTarea
          tareaId={tareaAbierta}
          onCerrar={() => setTareaAbierta(null)}
          onCambiada={() => void cargar()}
        />
      )}
    </section>
  )
}
