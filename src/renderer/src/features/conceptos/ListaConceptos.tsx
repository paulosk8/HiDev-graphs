import { useEffect, useMemo, useState } from 'react'
import type { ResumenConceptoDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { EstadoVacio } from '../../components/EstadoVacio'
import { textoMaterial } from '../../lib/material'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useLayoutStore } from '../../stores/layoutStore'
import { useUiStore, type Contexto } from '../../stores/uiStore'
import { FormularioConcepto } from './FormularioConcepto'

/**
 * Clave interna del grupo que reúne los conceptos que todavía no se usan en
 * ninguna asignatura ni espacio. Es un centinela, no un texto: se muestra como
 * «Todavía sin usar» —una bandeja de entrada— y no como «Sin asignatura», que
 * se leía como un error ("debería estar en una y no lo está") y hacía parecer
 * que la otra capa se colaba. El pool de conceptos es único a propósito: lo que
 * aprendes hoy es lo que enseñas mañana, y duplicarlo por capa duplicaría su
 * material, que es justo lo que la app evita.
 */
const SIN_GRUPO = '\u0000sin-grupo'

/** Normaliza para buscar sin distinguir mayúsculas ni acentos. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    // Elimina marcas diacríticas combinantes (U+0300–U+036F).
    .replace(/[̀-ͯ]/g, '')
}

interface Props {
  contexto: Contexto
}

export function ListaConceptos({ contexto }: Props): JSX.Element {
  const lista = useConceptosStore((s) => s.lista)
  const cargando = useConceptosStore((s) => s.cargando)
  const asignaturas = useAsignaturasStore((s) => s.lista)
  const seleccionar = useUiStore((s) => s.seleccionarConcepto)
  const intencion = useUiStore((s) => s.intencion)
  const limpiarIntencion = useUiStore((s) => s.limpiarIntencion)
  const [creando, setCreando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const etiquetaFiltrada = useUiStore((s) => s.etiquetaFiltrada)
  const filtrarPorEtiqueta = useUiStore((s) => s.filtrarPorEtiqueta)
  // Grupos (asignaturas) desplegados. Vacío = todos colapsados por defecto:
  // así ves una lista breve de grupos y decides cuál abrir.
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(new Set())
  // Conceptos cuyos temas están desplegados (colapsados por defecto para no saturar).
  const [temasAbiertos, setTemasAbiertos] = useState<Set<string>>(new Set())

  const esAprendizaje = contexto === 'aprendizaje'
  const dosCapas = useLayoutStore((s) => s.capaDocencia && s.capaAprendizaje)

  // "Nuevo concepto" desde la barra de menú: abre aquí el mismo formulario.
  useEffect(() => {
    if (intencion === 'nuevo-concepto') {
      setCreando(true)
      limpiarIntencion()
    }
  }, [intencion, limpiarIntencion])

  // Nombres de las asignaturas de ESTE contexto: filtran qué conceptos y grupos
  // se ven. El pool de conceptos es único; esto es solo una vista.
  const nombresContexto = useMemo(
    () =>
      new Set(
        asignaturas
          .filter((a) => (esAprendizaje ? a.tipo === 'aprendizaje' : a.tipo !== 'aprendizaje'))
          .map((a) => a.nombre)
      ),
    [asignaturas, esAprendizaje]
  )

  // Conceptos relevantes al contexto: los usados en alguna asignatura de este
  // contexto, más los que aún no se usan en ninguna (disponibles en ambos).
  const delContexto = useMemo(
    () =>
      lista.filter(
        (c) => c.asignaturas.length === 0 || c.asignaturas.some((a) => nombresContexto.has(a))
      ),
    [lista, nombresContexto]
  )

  const filtrada = useMemo(() => {
    // Primero la etiqueta (un filtro duro: "enséñame solo lo de evaluación") y
    // luego el texto, que busca DENTRO de lo ya filtrado.
    const porEtiqueta = etiquetaFiltrada
      ? delContexto.filter((c) =>
          c.etiquetas.some((e) => normalizar(e) === normalizar(etiquetaFiltrada))
        )
      : delContexto

    const q = normalizar(busqueda.trim())
    if (!q) return porEtiqueta
    return porEtiqueta.filter((c) => {
      const heno = normalizar(
        [c.nombre, c.descripcion, ...c.temas, ...c.asignaturas, ...c.etiquetas].filter(Boolean).join('  ')
      )
      return heno.includes(q)
    })
  }, [delContexto, busqueda, etiquetaFiltrada])

  /** Etiquetas presentes en este contexto, de más usada a menos. */
  const etiquetasDisponibles = useMemo(() => {
    const cuenta = new Map<string, { etiqueta: string; total: number }>()
    for (const c of delContexto) {
      for (const e of c.etiquetas) {
        const clave = normalizar(e)
        const previo = cuenta.get(clave)
        cuenta.set(clave, { etiqueta: previo?.etiqueta ?? e, total: (previo?.total ?? 0) + 1 })
      }
    }
    return [...cuenta.values()].sort(
      (a, b) => b.total - a.total || a.etiqueta.localeCompare(b.etiqueta, 'es')
    )
  }, [delContexto])

  // Agrupa los conceptos por la asignatura (o espacio) de este contexto; los
  // que no se usan en ninguna van al grupo de sueltos, al final.
  const grupos = useMemo(() => {
    const mapa = new Map<string, ResumenConceptoDTO[]>()
    for (const c of filtrada) {
      const propias = c.asignaturas.filter((a) => nombresContexto.has(a))
      const claves = propias.length > 0 ? propias : [SIN_GRUPO]
      for (const clave of claves) {
        const arr = mapa.get(clave) ?? []
        arr.push(c)
        mapa.set(clave, arr)
      }
    }
    return [...mapa.entries()].sort((a, b) => {
      if (a[0] === SIN_GRUPO) return 1
      if (b[0] === SIN_GRUPO) return -1
      return a[0].localeCompare(b[0], 'es')
    })
  }, [filtrada, nombresContexto])

  /** Rótulo visible de un grupo: su nombre real o, para los sueltos, la bandeja. */
  const rotuloGrupo = (clave: string): string =>
    clave === SIN_GRUPO ? 'Todavía sin usar' : clave

  /**
   * Los conceptos sueltos se ven desde las dos capas (el pool es único). Decirlo
   * aquí evita que parezca que se han colado los de la otra; sobra si el docente
   * solo tiene una capa encendida.
   */
  const ayudaSueltos = dosCapas
    ? 'Aún no los has vinculado a ningún tema. Están disponibles en Docencia y en Aprendizaje.'
    : 'Aún no los has vinculado a ningún tema.'

  const alternarGrupo = (nombre: string): void =>
    setGruposAbiertos((prev) => {
      const s = new Set(prev)
      s.has(nombre) ? s.delete(nombre) : s.add(nombre)
      return s
    })

  // Al buscar, se despliegan los grupos para que se vean los resultados.
  const hayBusqueda = busqueda.trim().length > 0

  const alternarTemas = (id: string): void =>
    setTemasAbiertos((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Conceptos</h1>
          <p className="mt-1 text-sm text-slate-500">
            {esAprendizaje
              ? 'Los conceptos de tus espacios de aprendizaje y su material.'
              : 'Los conceptos de tus asignaturas y el material de cada uno.'}
          </p>
        </div>
        <Boton variante="primario" onClick={() => setCreando(true)}>
          + Nuevo concepto
        </Boton>
      </header>

      {!cargando && delContexto.length > 0 && (
        <div className="mb-5">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, descripción, tema o etiqueta…"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-marca-400 focus:outline-none focus:ring-2 focus:ring-marca-100"
          />
          {etiquetasDisponibles.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {etiquetasDisponibles.map(({ etiqueta, total }) => {
                const activa =
                  etiquetaFiltrada !== null &&
                  normalizar(etiqueta) === normalizar(etiquetaFiltrada)
                return (
                  <button
                    key={etiqueta}
                    // Volver a pulsar la activa quita el filtro: no hace falta
                    // buscar una "x" aparte.
                    onClick={() => filtrarPorEtiqueta(activa ? null : etiqueta)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                      activa
                        ? 'bg-marca-600 text-white'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-marca-300'
                    }`}
                  >
                    {etiqueta}
                    <span className={activa ? 'ml-1 text-marca-100' : 'ml-1 text-slate-400'}>
                      {total}
                    </span>
                  </button>
                )
              })}
              {etiquetaFiltrada && (
                <button
                  onClick={() => filtrarPorEtiqueta(null)}
                  className="text-xs text-slate-500 underline-offset-2 hover:underline"
                >
                  Quitar filtro
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {cargando ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
      ) : delContexto.length === 0 ? (
        <EstadoVacio
          icono="💡"
          titulo={esAprendizaje ? 'Aún no hay conceptos por aquí' : 'Todavía no tienes conceptos'}
          descripcion={
            esAprendizaje
              ? 'Crea un concepto y vincúlalo a los temas de un espacio de aprendizaje para verlo aquí.'
              : 'Crea tu primer concepto para empezar a organizar tu material y reutilizarlo entre asignaturas.'
          }
        >
          <Boton variante="primario" onClick={() => setCreando(true)}>
            {esAprendizaje ? '+ Nuevo concepto' : '+ Crear mi primer concepto'}
          </Boton>
        </EstadoVacio>
      ) : filtrada.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          Ningún concepto coincide con «{busqueda}».
        </p>
      ) : (
        <div className="space-y-3">
          {grupos.map(([grupo, conceptos]) => {
            const abierto = hayBusqueda || gruposAbiertos.has(grupo)
            return (
              <section key={grupo} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <button
                  onClick={() => alternarGrupo(grupo)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <span className="min-w-0 font-medium text-slate-800">
                    {rotuloGrupo(grupo)}{' '}
                    <span className="text-sm font-normal text-slate-400">({conceptos.length})</span>
                    {grupo === SIN_GRUPO && (
                      <span className="mt-0.5 block text-xs font-normal text-slate-400">
                        {ayudaSueltos}
                      </span>
                    )}
                  </span>
                  <span className="text-slate-400">{abierto ? '▾' : '▸'}</span>
                </button>
                {abierto && (
                  <ul className="divide-y divide-slate-100 border-t border-slate-100">
                    {conceptos.map((c) => {
                      const temasVisibles = temasAbiertos.has(c.id)
                      return (
                        <li key={c.id}>
                          {/* Fila compacta: nombre (abre la ficha) + estadísticas + desplegar temas */}
                          <div className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50">
                            <button
                              onClick={() => seleccionar(c.id)}
                              className="min-w-0 flex-1 truncate text-left font-medium text-slate-800 hover:text-marca-700"
                            >
                              {c.nombre}
                            </button>
                            <span className="shrink-0 text-xs text-slate-400">
                              {c.temas.length === 0
                                ? 'Sin temas'
                                : `${c.temas.length} ${c.temas.length === 1 ? 'tema' : 'temas'}`}
                              {' · '}
                              {textoMaterial(c).toLowerCase()}
                            </span>
                            {c.temas.length > 0 && (
                              <button
                                onClick={() => alternarTemas(c.id)}
                                title={temasVisibles ? 'Ocultar temas' : 'Ver temas'}
                                aria-label={temasVisibles ? 'Ocultar temas' : 'Ver temas'}
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                              >
                                {temasVisibles ? '▾' : '▸'}
                              </button>
                            )}
                          </div>
                          {/* Temas del concepto: como lista vertical, solo al desplegar */}
                          {temasVisibles && c.temas.length > 0 && (
                            <ul className="space-y-0.5 border-t border-slate-100 bg-slate-50 px-4 py-2 pl-6">
                              {c.temas.map((t) => (
                                <li key={t} className="flex items-start gap-2 text-xs text-slate-600">
                                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-marca-400" />
                                  <span>{t}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

      {creando && (
        <FormularioConcepto onCerrar={() => setCreando(false)} onGuardado={(id) => seleccionar(id)} />
      )}
    </div>
  )
}
