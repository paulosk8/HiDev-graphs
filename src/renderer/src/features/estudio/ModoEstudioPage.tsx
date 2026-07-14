import { useMemo, useState } from 'react'
import type { CalidadRepaso, ResumenConceptoDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { Modal } from '../../components/Modal'
import { EstadoVacio } from '../../components/EstadoVacio'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useConceptosStore } from '../../stores/conceptosStore'
import { colorDominio, conceptosDeAprendizaje, etiquetaDominio, pendientesHoy } from '../../lib/repaso'

type Fase = 'inicio' | 'sesion' | 'fin'

const VALORACIONES: { calidad: CalidadRepaso; etiqueta: string; ayuda: string; clase: string }[] = [
  { calidad: 0, etiqueta: 'No lo sé', ayuda: 'Repasar pronto', clase: 'bg-red-500 hover:bg-red-600' },
  { calidad: 3, etiqueta: 'Difícil', ayuda: 'Con esfuerzo', clase: 'bg-amber-500 hover:bg-amber-600' },
  { calidad: 4, etiqueta: 'Bien', ayuda: 'Lo recuerdo', clase: 'bg-lime-600 hover:bg-lime-700' },
  { calidad: 5, etiqueta: 'Fácil', ayuda: 'Lo domino', clase: 'bg-emerald-600 hover:bg-emerald-700' }
]

export function ModoEstudioPage(): JSX.Element {
  const listaTodos = useConceptosStore((s) => s.lista)
  const asignaturas = useAsignaturasStore((s) => s.lista)
  const repasar = useConceptosStore((s) => s.repasar)

  // El repaso es de la capa de aprendizaje: solo sus conceptos.
  const lista = useMemo(
    () => conceptosDeAprendizaje(listaTodos, asignaturas),
    [listaTodos, asignaturas]
  )

  const [fase, setFase] = useState<Fase>('inicio')
  const [cola, setCola] = useState<ResumenConceptoDTO[]>([])
  const [indice, setIndice] = useState(0)
  const [mostrarReverso, setMostrarReverso] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [repasados, setRepasados] = useState(0)

  const pendientes = useMemo(() => pendientesHoy(lista), [lista])

  const empezar = (conceptos: ResumenConceptoDTO[]): void => {
    if (conceptos.length === 0) return
    setCola(conceptos)
    setIndice(0)
    setRepasados(0)
    setMostrarReverso(false)
    setFase('sesion')
  }

  const valorar = async (calidad: CalidadRepaso): Promise<void> => {
    const actual = cola[indice]
    if (!actual || guardando) return
    setGuardando(true)
    const ok = await repasar(actual.id, calidad)
    setGuardando(false)
    if (!ok) return
    setRepasados((n) => n + 1)
    if (indice + 1 >= cola.length) {
      setFase('fin')
    } else {
      setIndice((i) => i + 1)
      setMostrarReverso(false)
    }
  }

  // --- Pantalla de inicio ---
  if (fase === 'inicio') {
    return (
      <Contenedor>
        <Cabecera />
        {pendientes.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-5xl font-semibold text-marca-600">{pendientes.length}</p>
            <p className="mt-2 text-sm text-slate-600">
              {pendientes.length === 1 ? 'concepto para repasar hoy' : 'conceptos para repasar hoy'}
            </p>
            <div className="mt-6">
              <Boton variante="primario" onClick={() => empezar(pendientes)}>
                Empezar repaso
              </Boton>
            </div>
          </div>
        ) : lista.length === 0 ? (
          <EstadoVacio
            icono="🎯"
            titulo="Aún no hay nada que repasar"
            descripcion="Crea un espacio de aprendizaje (en «Aprendizaje › Espacios»), vincula conceptos a sus temas y aquí podrás repasarlos para no olvidarlos."
          />
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <p className="text-3xl">🎉</p>
            <p className="mt-2 text-sm font-medium text-emerald-800">Nada que repasar hoy</p>
            <p className="mt-1 text-xs text-emerald-700">
              Vuelve mañana o repasa igualmente para reforzar lo que ya sabes.
            </p>
            <div className="mt-6">
              <Boton variante="secundario" onClick={() => empezar([...lista])}>
                Repasar todos de todas formas
              </Boton>
            </div>
          </div>
        )}
      </Contenedor>
    )
  }

  // --- Pantalla final ---
  if (fase === 'fin') {
    return (
      <Contenedor>
        <Cabecera />
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="text-3xl">✅</p>
          <p className="mt-2 text-sm font-medium text-emerald-800">
            ¡Listo! Repasaste {repasados} {repasados === 1 ? 'concepto' : 'conceptos'}.
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            Cada repaso ajusta cuándo te lo volveremos a mostrar.
          </p>
          <div className="mt-6">
            <Boton variante="secundario" onClick={() => setFase('inicio')}>
              Volver
            </Boton>
          </div>
        </div>
      </Contenedor>
    )
  }

  // --- Sesión ---
  const actual = cola[indice]
  if (!actual) return <Contenedor><Cabecera /></Contenedor>
  const progreso = Math.round((indice / cola.length) * 100)

  return (
    <Contenedor>
      <Cabecera />

      {/* Progreso */}
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs text-slate-400">
          <span>
            {indice + 1} de {cola.length}
          </span>
          <span>{repasados} repasados</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-marca-500 transition-all" style={{ width: `${progreso}%` }} />
        </div>
      </div>

      {/* Tarjeta */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: colorDominio(actual) }}
            title={etiquetaDominio(actual)}
          />
          <span className="text-xs text-slate-400">{etiquetaDominio(actual)}</span>
        </div>

        <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">¿Qué recuerdas sobre…</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">{actual.nombre}</h2>
        {actual.temas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {actual.temas.slice(0, 6).map((t) => (
              <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                {t}
              </span>
            ))}
          </div>
        )}

        {!mostrarReverso ? (
          <div className="mt-8 text-center">
            <Boton variante="secundario" onClick={() => setMostrarReverso(true)}>
              Mostrar respuesta
            </Boton>
            <p className="mt-3 text-xs text-slate-400">
              Intenta recordarlo tú primero; luego valora qué tal te fue.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 border-t border-slate-100 pt-5">
              {actual.descripcion ? (
                <p className="text-sm text-slate-700">{actual.descripcion}</p>
              ) : (
                <p className="text-sm italic text-slate-400">
                  Este concepto no tiene descripción. Ábrelo desde «Conceptos» para añadirla o repasar su material.
                </p>
              )}
              <p className="mt-3 text-xs text-slate-400">
                {actual.totalRecursos === 0
                  ? 'Sin material'
                  : `${actual.totalRecursos} ${actual.totalRecursos === 1 ? 'material' : 'materiales'} disponible${actual.totalRecursos === 1 ? '' : 's'}`}
              </p>
            </div>

            <div className="mt-6">
              <p className="mb-2 text-xs font-medium text-slate-500">¿Qué tal lo recordaste?</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {VALORACIONES.map((v) => (
                  <button
                    key={v.calidad}
                    onClick={() => void valorar(v.calidad)}
                    disabled={guardando}
                    className={`flex flex-col items-center rounded-xl px-3 py-2.5 text-white transition disabled:opacity-50 ${v.clase}`}
                  >
                    <span className="text-sm font-semibold">{v.etiqueta}</span>
                    <span className="text-[11px] opacity-90">{v.ayuda}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Contenedor>
  )
}

function Contenedor({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="mx-auto max-w-2xl px-8 py-8">{children}</div>
}

function Cabecera(): JSX.Element {
  return (
    <header className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Repaso</h1>
        <AyudaRepaso />
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Refuerza los conceptos de tus espacios de aprendizaje con repaso espaciado: recuerda,
        valora y el sistema decide cuándo volver a mostrártelos.
      </p>
    </header>
  )
}

/** Explicador de cómo funciona el repaso (autocontenido: gestiona su propia apertura). */
function AyudaRepaso(): JSX.Element {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
      >
        ¿Cómo funciona?
      </button>
      {abierto && (
        <Modal titulo="¿Cómo funciona el repaso?" ancho="lg" onCerrar={() => setAbierto(false)}>
          <div className="space-y-5 text-sm text-slate-600">
            <p>
              El repaso usa <strong>recuerdo activo</strong> y <strong>repetición espaciada</strong>{' '}
              para que recuerdes a largo plazo con poco esfuerzo diario. Cada día te muestra lo que
              conviene repasar.
            </p>

            <ol className="space-y-2">
              <li>
                <span className="font-medium text-slate-700">1. Recuerda.</span> Ves el nombre del
                concepto e intentas recordarlo tú.
              </li>
              <li>
                <span className="font-medium text-slate-700">2. Comprueba.</span> Muestras la
                respuesta (su descripción y material) y ves si acertaste.
              </li>
              <li>
                <span className="font-medium text-slate-700">3. Valora.</span> Dices qué tal te fue;
                según eso se ajusta cuándo vuelve a aparecer y tu nivel de dominio.
              </li>
            </ol>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Las valoraciones
              </p>
              <ul className="space-y-1.5">
                {[
                  ['bg-red-500', 'No lo sé', 'Baja tu dominio y vuelve mañana.'],
                  ['bg-amber-500', 'Difícil', 'Lo recordaste con esfuerzo; vuelve pronto.'],
                  ['bg-lime-600', 'Bien', 'Sube tu dominio y se espacia.'],
                  ['bg-emerald-600', 'Fácil', 'Sube tu dominio y se espacia aún más.']
                ].map(([clase, etiqueta, desc]) => (
                  <li key={etiqueta} className="flex items-center gap-2">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${clase}`} />
                    <span className="font-medium text-slate-700">{etiqueta}:</span>
                    <span>{desc}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs text-slate-600">
                <strong>Míralo en el mapa.</strong> En <strong>Aprendizaje › Mapa</strong>, activa{' '}
                <strong>«🎯 Dominio»</strong> para ver en colores qué dominas y qué te falta:
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#cbd5e1' }} /> Sin repasar
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#ef4444' }} /> No lo sé
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} /> A profundizar
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#22c55e' }} /> Dominado
                </li>
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
