import { useCallback, useEffect, useState } from 'react'
import type {
  AsignaturaDTO,
  FichaConceptoDTO,
  ResumenLienzoDTO,
  ResumenMencionDTO,
  ResumenTareaDTO,
  UsoDeConceptoDTO
} from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { DialogoConfirmacion } from '../../components/DialogoConfirmacion'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useVistazoStore } from '../../stores/vistazoStore'
import { useUiStore } from '../../stores/uiStore'
import {
  avisoDeEliminacion,
  useEliminacionStore
} from '../../stores/eliminacionStore'
import { FormularioConcepto } from './FormularioConcepto'
import { EtiquetasConcepto } from './EtiquetasConcepto'
import { NotasConcepto } from './NotasConcepto'
import { TerminosConcepto } from './TerminosConcepto'
import { ZonaMaterial } from './ZonaMaterial'
import { FichaTarea } from '../tareas/FichaTarea'
import { FormularioTarea } from '../tareas/FormularioTarea'

interface Props {
  conceptoId: string
}

export function FichaConcepto({ conceptoId }: Props): JSX.Element {
  const modoEliminacion = useEliminacionStore((s) => s.modo)
  const [ficha, setFicha] = useState<FichaConceptoDTO | null>(null)
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [tareas, setTareas] = useState<ResumenTareaDTO[]>([])
  const [tareaAbierta, setTareaAbierta] = useState<string | null>(null)
  /**
   * Crear una práctica DE este concepto sin salir de su ficha. Es aquí donde el
   * docente acaba de subir el material, y es aquí donde decide que quiere pedir
   * algo con él; hasta ahora el «＋» solo estaba en el chip del concepto, dentro
   * de la asignatura. Una práctica cuelga de un tema, así que hay que saber en
   * cuál de los usos del concepto se crea.
   */
  const [creandoEn, setCreandoEn] = useState<{
    asignatura: AsignaturaDTO
    temaId: string
  } | null>(null)
  const [eligiendoUso, setEligiendoUso] = useState(false)
  const [preparando, setPreparando] = useState(false)
  // "Se menciona en": lo resuelve el proceso principal escaneando las notas del
  // vault (el enlace vive dentro del texto, no en el índice).
  const [menciones, setMenciones] = useState<ResumenMencionDTO[]>([])
  /** Lienzos donde aparece este concepto (o su material). */
  const [lienzos, setLienzos] = useState<ResumenLienzoDTO[]>([])

  // La ficha se abre desde las dos capas: en Aprendizaje no hay asignaturas
  // ni períodos, así que los textos se adaptan al contexto activo.
  const esAprendizaje = useUiStore((s) => s.contexto) === 'aprendizaje'
  const volver = useUiStore((s) => s.seleccionarConcepto)
  const irASeccion = useUiStore((s) => s.irASeccion)
  const fijarEtiqueta = useUiStore((s) => s.filtrarPorEtiqueta)

  /** Pulsar una etiqueta sale de la ficha y deja el listado ya filtrado por ella. */
  const filtrarPorEtiqueta = (etiqueta: string): void => {
    fijarEtiqueta(etiqueta)
    volver(null)
  }
  const notificarError = useUiStore((s) => s.notificarError)
  const eliminar = useConceptosStore((s) => s.eliminar)
  const asignaturas = useAsignaturasStore((s) => s.lista)
  const abrirVistazo = useVistazoStore((s) => s.abrir)

  const cargarTareas = useCallback(async () => {
    try {
      setTareas(await api.listarTareasDeConcepto(conceptoId))
    } catch {
      /* no bloquea la ficha */
    }
  }, [conceptoId])

  useEffect(() => {
    void cargarTareas()
  }, [cargarTareas])

  useEffect(() => {
    let vivo = true
    void api
      .lienzosDeConcepto(conceptoId)
      .then((l) => vivo && setLienzos(l))
      .catch(() => vivo && setLienzos([]))
    return () => {
      vivo = false
    }
  }, [conceptoId])

  useEffect(() => {
    let vivo = true
    void api
      .obtenerMenciones(conceptoId)
      .then((m) => vivo && setMenciones(m))
      .catch(() => vivo && setMenciones([]))
    return () => {
      vivo = false
    }
  }, [conceptoId])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setFicha(await api.obtenerFichaConcepto(conceptoId))
    } catch (error) {
      notificarError(error)
      volver(null)
    } finally {
      setCargando(false)
    }
  }, [conceptoId, notificarError, volver])

  useEffect(() => {
    void cargar()
  }, [cargar])

  /** Trae la asignatura entera (el formulario la necesita) y abre el formulario. */
  const nuevaPractica = async (uso: UsoDeConceptoDTO): Promise<void> => {
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

  const confirmarEliminar = async (): Promise<void> => {
    if (!ficha) return
    const ok = await eliminar(conceptoId, ficha.concepto.nombre)
    if (ok) volver(null)
  }

  if (cargando || !ficha) {
    return <p className="px-8 py-10 text-sm text-slate-400">Cargando…</p>
  }

  const { concepto, usos } = ficha
  const etiquetaPractica = esAprendizaje ? 'práctica' : 'tarea'
  /**
   * Dónde puede ir una práctica nueva. Cuelga del tema, así que dos usos del
   * mismo tema (uno por el tema y otro por un subtema suyo) son el mismo
   * destino y se ofrecen una sola vez.
   */
  const destinos = usos.filter(
    (u, i) =>
      usos.findIndex((o) => o.asignaturaId === u.asignaturaId && o.temaId === u.temaId) === i
  )
  const crearPractica = (): void => {
    const [primero, ...resto] = destinos
    if (!primero) return
    if (resto.length === 0) void nuevaPractica(primero)
    else setEligiendoUso(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <button
        onClick={() => volver(null)}
        className="mb-5 text-sm text-slate-500 transition hover:text-slate-800"
      >
        ← Conceptos
      </button>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{concepto.nombre}</h1>
          {concepto.descripcion && (
            <p className="mt-2 max-w-prose text-sm text-slate-600">{concepto.descripcion}</p>
          )}
          {/* Editables aquí mismo: abrir «Editar» para añadir una palabra era
              demasiado viaje. Pulsar el texto sigue filtrando el listado. */}
          <div className="mt-3">
            <EtiquetasConcepto
              concepto={concepto}
              onActualizado={(actualizado) =>
                setFicha((f) => (f ? { ...f, concepto: actualizado } : f))
              }
              alFiltrar={filtrarPorEtiqueta}
            />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Boton variante="secundario" onClick={() => setEditando(true)}>
            Editar
          </Boton>
          <Boton variante="fantasma" onClick={() => setConfirmando(true)}>
            Eliminar
          </Boton>
        </div>
      </header>

      {/* Términos y definiciones: referencia que se consulta mientras se lee,
          así que va antes del material y de las notas. */}
      <TerminosConcepto
        concepto={concepto}
        onActualizado={(actualizado) =>
          setFicha((f) => (f ? { ...f, concepto: actualizado } : f))
        }
      />

      {/* Material */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Material
        </h2>
        <ZonaMaterial
          conceptoId={concepto.id}
          recursos={concepto.recursos}
          enlaces={concepto.enlaces}
          onActualizado={(actualizado) =>
            setFicha((f) => (f ? { ...f, concepto: actualizado } : f))
          }
        />
      </section>

      {/* Notas y observaciones */}
      <NotasConcepto concepto={concepto} onGuardado={() => void cargar()} />

      {/* Se usa en */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Se usa en
        </h2>
        {usos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
            {esAprendizaje
              ? 'Este concepto todavía no se usa en ningún espacio de aprendizaje.'
              : 'Este concepto todavía no se usa en ninguna asignatura.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {usos.map((uso) => {
              // En Aprendizaje el nivel superior está aplanado: el camino va del
              // espacio directo al tema.
              const enEspacio =
                asignaturas.find((a) => a.id === uso.asignaturaId)?.tipo === 'aprendizaje'
              return (
              <li
                key={`${uso.asignaturaId}-${uso.temaId}-${uso.subtema ?? ''}`}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700"
              >
                <span className="font-medium">
                  {uso.asignatura}
                  {uso.periodos.length > 0 && ` · ${uso.periodos.join(', ')}`}
                </span>
                <span className="text-slate-400">
                  {enEspacio ? ' › ' : ` › ${uso.unidad} › `}
                </span>
                {/* Si el vínculo es del 3er nivel, el tema es sólo el camino. */}
                {uso.subtema ? (
                  <>
                    <span className="text-slate-400">{uso.tema} › </span>
                    <span>{uso.subtema}</span>
                  </>
                ) : (
                  <span>{uso.tema}</span>
                )}
              </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* En qué lienzos aparece */}
      {lienzos.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Aparece en estos lienzos
          </h2>
          <ul className="space-y-2">
            {lienzos.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => irASeccion('lienzos', l.contexto)}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm transition hover:border-marca-300 hover:shadow-sm"
                >
                  <span aria-hidden>🗺️</span>
                  <span className="flex-1 truncate font-medium text-slate-700">{l.nombre}</span>
                  <span className="text-xs text-slate-400">
                    {l.totalTarjetas} {l.totalTarjetas === 1 ? 'tarjeta' : 'tarjetas'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Se menciona en (retroenlaces desde las notas de otros conceptos) */}
      {menciones.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Se menciona en
          </h2>
          <ul className="space-y-2">
            {menciones.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => abrirVistazo(c.id)}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm transition hover:border-marca-300 hover:shadow-sm"
                >
                  <span className="flex-1 truncate font-medium text-slate-700">{c.nombre}</span>
                  <span className="text-xs text-slate-400">Ver</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Prácticas basadas en este concepto. La sección está SIEMPRE, aunque no
          haya ninguna: es el sitio donde crear la primera, justo después de
          subir el material con el que se va a pedir. */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {esAprendizaje ? 'Prácticas' : 'Tareas'} basadas en este concepto
          </h2>
          <Boton
            variante="fantasma"
            onClick={crearPractica}
            disabled={destinos.length === 0 || preparando}
            title={
              destinos.length === 0
                ? `Vincula antes el concepto a un tema: una ${etiquetaPractica} vive dentro de ${
                    esAprendizaje ? 'un espacio de aprendizaje' : 'una asignatura'
                  }.`
                : undefined
            }
          >
            {preparando ? 'Abriendo…' : `+ Nueva ${etiquetaPractica}`}
          </Boton>
        </div>
        {tareas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
            {destinos.length === 0
              ? `Cuando este concepto se use en un tema podrás crear aquí una ${etiquetaPractica} con su material.`
              : `Todavía no hay ninguna ${etiquetaPractica} basada en este concepto.`}
          </p>
        ) : (
          <ul className="space-y-2">
            {tareas.map((t) => {
              const asig = asignaturas.find((a) => a.id === t.asignaturaId)
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setTareaAbierta(t.id)}
                    className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm transition hover:border-marca-300 hover:shadow-sm"
                  >
                    <span className="flex-1 truncate font-medium text-slate-700">{t.titulo}</span>
                    {asig && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {asig.nombre} · {asig.periodos.join(', ')}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* El concepto puede estar en varios temas y la práctica solo cuelga de
          uno: se pregunta en vez de elegir por él. */}
      {eligiendoUso && (
        <Modal
          titulo={`¿Dónde va esta ${etiquetaPractica}?`}
          descripcion={`«${concepto.nombre}» se usa en varios temas. Elige en cuál se crea; en el formulario puedes cambiarlo.`}
          onCerrar={() => setEligiendoUso(false)}
        >
          <ul className="space-y-2">
            {destinos.map((uso) => (
              <li key={`${uso.asignaturaId}-${uso.temaId}`}>
                <button
                  onClick={() => void nuevaPractica(uso)}
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
            void cargarTareas()
            setTareaAbierta(t.id)
          }}
        />
      )}

      {tareaAbierta && (
        <FichaTarea
          tareaId={tareaAbierta}
          onCerrar={() => setTareaAbierta(null)}
          onCambiada={() => void cargarTareas()}
        />
      )}

      {editando && (
        <FormularioConcepto
          conceptoInicial={{
            id: concepto.id,
            nombre: concepto.nombre,
            descripcion: concepto.descripcion,
            etiquetas: concepto.etiquetas
          }}
          onCerrar={() => setEditando(false)}
          onGuardado={() => void cargar()}
        />
      )}

      {confirmando && (
        <DialogoConfirmacion
          titulo={`¿Eliminar «${concepto.nombre}»?`}
          mensaje={`Se eliminará el concepto y todo su material. ${avisoDeEliminacion(modoEliminacion)}`}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setConfirmando(false)}
        />
      )}
    </div>
  )
}
