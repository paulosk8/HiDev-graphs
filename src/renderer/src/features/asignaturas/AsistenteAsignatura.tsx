import { useState } from 'react'
import { COMPONENTES_SUGERIDOS, type ComponenteDTO, type DatosAsignaturaDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { CampoTexto } from '../../components/Campos'
import { Modal } from '../../components/Modal'
import { useAsignaturasStore } from '../../stores/asignaturasStore'

let secuencia = 0
const nuevoId = (): string => `b${++secuencia}`

interface TemaBorrador {
  id: string
  titulo: string
}
interface UnidadBorrador {
  id: string
  titulo: string
  temas: TemaBorrador[]
}

interface Props {
  onCerrar: () => void
  onCreada: (id: string) => void
}

const PASOS = ['Datos', 'Componentes', 'Contenido']

export function AsistenteAsignatura({ onCerrar, onCreada }: Props): JSX.Element {
  const crear = useAsignaturasStore((s) => s.crear)

  const [paso, setPaso] = useState(1)
  const [ocupado, setOcupado] = useState(false)

  const [nombre, setNombre] = useState('')
  const [periodos, setPeriodos] = useState<string[]>([])
  const [periodoNuevo, setPeriodoNuevo] = useState('')
  const [componentes, setComponentes] = useState<ComponenteDTO[]>([...COMPONENTES_SUGERIDOS])
  const [claveNueva, setClaveNueva] = useState('')
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [unidades, setUnidades] = useState<UnidadBorrador[]>([
    { id: nuevoId(), titulo: '', temas: [{ id: nuevoId(), titulo: '' }] }
  ])

  // --- Componentes ---
  const quitarComponente = (clave: string): void =>
    setComponentes((cs) => cs.filter((c) => c.clave !== clave))
  const agregarComponente = (comp: ComponenteDTO): void =>
    setComponentes((cs) => (cs.some((c) => c.clave === comp.clave) ? cs : [...cs, comp]))
  const agregarComponentePersonalizado = (): void => {
    const clave = claveNueva.trim().toUpperCase()
    const nombreC = nombreNuevo.trim()
    if (!clave || !nombreC) return
    agregarComponente({ clave, nombre: nombreC })
    setClaveNueva('')
    setNombreNuevo('')
  }
  const sugeridosDisponibles = COMPONENTES_SUGERIDOS.filter(
    (s) => !componentes.some((c) => c.clave === s.clave)
  )

  // --- Unidades / temas ---
  const modificarUnidad = (id: string, cambio: Partial<UnidadBorrador>): void =>
    setUnidades((us) => us.map((u) => (u.id === id ? { ...u, ...cambio } : u)))
  const agregarUnidad = (): void =>
    setUnidades((us) => [...us, { id: nuevoId(), titulo: '', temas: [{ id: nuevoId(), titulo: '' }] }])
  const quitarUnidad = (id: string): void => setUnidades((us) => us.filter((u) => u.id !== id))
  const agregarTema = (unidadId: string): void =>
    modificarTemas(unidadId, (temas) => [...temas, { id: nuevoId(), titulo: '' }])
  const quitarTema = (unidadId: string, temaId: string): void =>
    modificarTemas(unidadId, (temas) => temas.filter((t) => t.id !== temaId))
  const modificarTema = (unidadId: string, temaId: string, cambio: Partial<TemaBorrador>): void =>
    modificarTemas(unidadId, (temas) => temas.map((t) => (t.id === temaId ? { ...t, ...cambio } : t)))
  function modificarTemas(unidadId: string, fn: (t: TemaBorrador[]) => TemaBorrador[]): void {
    setUnidades((us) => us.map((u) => (u.id === unidadId ? { ...u, temas: fn(u.temas) } : u)))
  }

  // --- Validación / envío ---
  const agregarPeriodo = (): void => {
    const p = periodoNuevo.trim()
    if (p && !periodos.includes(p)) setPeriodos((prev) => [...prev, p])
    setPeriodoNuevo('')
  }
  const quitarPeriodo = (p: string): void => setPeriodos((prev) => prev.filter((x) => x !== p))

  const datosCompletos = nombre.trim().length > 0 && periodos.length > 0
  const hayContenido = unidades.some((u) => u.titulo.trim().length > 0)

  const finalizar = async (): Promise<void> => {
    const datos: DatosAsignaturaDTO = {
      nombre: nombre.trim(),
      periodos,
      componentes,
      unidades: unidades
        .filter((u) => u.titulo.trim().length > 0)
        .map((u) => ({
          titulo: u.titulo.trim(),
          temas: u.temas
            .filter((t) => t.titulo.trim().length > 0)
            .map((t) => ({
              titulo: t.titulo.trim(),
              semana: null
            }))
        }))
    }
    setOcupado(true)
    const creada = await crear(datos)
    setOcupado(false)
    if (creada) {
      onCreada(creada.id)
      onCerrar()
    }
  }

  return (
    <Modal titulo="Nueva asignatura" ancho="xl" onCerrar={onCerrar}>
      {/* Indicador de pasos */}
      <ol className="mb-6 flex items-center gap-2 text-xs">
        {PASOS.map((etiqueta, i) => {
          const n = i + 1
          const activo = n === paso
          const hecho = n < paso
          return (
            <li key={etiqueta} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full font-semibold ${
                  activo
                    ? 'bg-marca-600 text-white'
                    : hecho
                      ? 'bg-marca-100 text-marca-700'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {n}
              </span>
              <span className={activo ? 'font-medium text-slate-700' : 'text-slate-400'}>
                {etiqueta}
              </span>
              {n < PASOS.length && <span className="flex-1 border-t border-slate-200" />}
            </li>
          )
        })}
      </ol>

      {/* Paso 1: Datos */}
      {paso === 1 && (
        <div className="space-y-4">
          <CampoTexto
            etiqueta="Nombre de la asignatura"
            placeholder="Ej. Algoritmos"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
          />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Períodos</span>
            <div className="flex gap-2">
              <input
                value={periodoNuevo}
                onChange={(e) => setPeriodoNuevo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    agregarPeriodo()
                  }
                }}
                placeholder="Ej. 2026A"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
              />
              <Boton variante="secundario" onClick={agregarPeriodo} disabled={!periodoNuevo.trim()}>
                Añadir
              </Boton>
            </div>
            {periodos.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {periodos.map((p) => (
                  <li
                    key={p}
                    className="flex items-center gap-1 rounded-full bg-marca-50 py-0.5 pl-3 pr-2 text-sm text-marca-700"
                  >
                    {p}
                    <button
                      onClick={() => quitarPeriodo(p)}
                      className="text-marca-400 hover:text-red-600"
                      aria-label={`Quitar ${p}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <span className="mt-1 block text-xs text-slate-400">
              Puedes añadir varios períodos: la misma asignatura se dicta en todos ellos.
            </span>
          </div>
        </div>
      )}

      {/* Paso 2: Componentes */}
      {paso === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Los componentes de aprendizaje de esta asignatura (ej. contacto docente,
            aprendizaje autónomo). Puedes quitar los que no uses o añadir los tuyos.
          </p>

          {componentes.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {componentes.map((c) => (
                <li
                  key={c.clave}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-2 text-sm"
                >
                  <span className="font-semibold text-slate-700">{c.clave}</span>
                  <span className="text-slate-500">{c.nombre}</span>
                  <button
                    onClick={() => quitarComponente(c.clave)}
                    className="text-slate-400 hover:text-red-600"
                    aria-label={`Quitar ${c.clave}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Sin componentes. Puedes añadir alguno abajo.</p>
          )}

          {sugeridosDisponibles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sugeridosDisponibles.map((s) => (
                <button
                  key={s.clave}
                  onClick={() => agregarComponente(s)}
                  className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm text-slate-500 hover:border-marca-300 hover:text-marca-700"
                >
                  + {s.clave} · {s.nombre}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 border-t border-slate-100 pt-4">
            <div className="w-24">
              <CampoTexto
                etiqueta="Sigla"
                placeholder="CD"
                value={claveNueva}
                onChange={(e) => setClaveNueva(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <CampoTexto
                etiqueta="Nombre del componente"
                placeholder="Contacto docente"
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
              />
            </div>
            <Boton
              variante="secundario"
              onClick={agregarComponentePersonalizado}
              disabled={!claveNueva.trim() || !nombreNuevo.trim()}
            >
              Añadir
            </Boton>
          </div>
        </div>
      )}

      {/* Paso 3: Unidades y temas */}
      {paso === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Organiza el contenido en unidades y temas.
          </p>

          {unidades.map((unidad, i) => (
            <div key={unidad.id} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">Unidad {i + 1}</span>
                {unidades.length > 1 && (
                  <button
                    onClick={() => quitarUnidad(unidad.id)}
                    className="ml-auto text-xs text-slate-400 hover:text-red-600"
                  >
                    Quitar unidad
                  </button>
                )}
              </div>
              <input
                value={unidad.titulo}
                onChange={(e) => modificarUnidad(unidad.id, { titulo: e.target.value })}
                placeholder="Título de la unidad (ej. Fundamentos)"
                className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
              />

              <div className="space-y-2 pl-3">
                {unidad.temas.map((tema) => (
                  <div key={tema.id} className="flex items-center gap-2">
                    <input
                      value={tema.titulo}
                      onChange={(e) => modificarTema(unidad.id, tema.id, { titulo: e.target.value })}
                      placeholder="Tema"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
                    />
                    {unidad.temas.length > 1 && (
                      <button
                        onClick={() => quitarTema(unidad.id, tema.id)}
                        className="text-slate-400 hover:text-red-600"
                        aria-label="Quitar tema"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => agregarTema(unidad.id)}
                  className="text-sm text-marca-600 hover:text-marca-700"
                >
                  + Agregar tema
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={agregarUnidad}
            className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-sm text-slate-500 hover:border-marca-300 hover:text-marca-700"
          >
            + Agregar unidad
          </button>
        </div>
      )}

      {/* Pie de navegación */}
      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
        <Boton variante="fantasma" onClick={onCerrar} disabled={ocupado}>
          Cancelar
        </Boton>
        <div className="flex gap-2">
          {paso > 1 && (
            <Boton variante="secundario" onClick={() => setPaso((p) => p - 1)} disabled={ocupado}>
              Atrás
            </Boton>
          )}
          {paso < 3 ? (
            <Boton
              variante="primario"
              onClick={() => setPaso((p) => p + 1)}
              disabled={paso === 1 && !datosCompletos}
            >
              Siguiente
            </Boton>
          ) : (
            <Boton variante="primario" onClick={finalizar} disabled={ocupado || !hayContenido}>
              {ocupado ? 'Creando…' : 'Crear asignatura'}
            </Boton>
          )}
        </div>
      </div>
    </Modal>
  )
}
