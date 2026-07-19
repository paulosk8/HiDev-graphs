import { useState, type ReactNode } from 'react'
import { Boton } from '../../components/Boton'
import { DialogoConfirmacion } from '../../components/DialogoConfirmacion'
import { api } from '../../lib/api'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useLayoutStore } from '../../stores/layoutStore'
import { useUiStore } from '../../stores/uiStore'
import { AsistentePage } from '../asistente/AsistentePage'
import { AlmacenamientoNube } from './AlmacenamientoNube'

type SeccionConfig = 'apariencia' | 'asistente' | 'datos'

const MENU: { clave: SeccionConfig; etiqueta: string; icono: string }[] = [
  { clave: 'apariencia', etiqueta: 'Apariencia', icono: '🎨' },
  { clave: 'asistente', etiqueta: 'Asistente IA', icono: '🤖' },
  { clave: 'datos', etiqueta: 'Datos y copias', icono: '☁️' }
]

export function ConfiguracionPage(): JSX.Element {
  const [seccion, setSeccion] = useState<SeccionConfig>('apariencia')

  return (
    <div className="flex h-full">
      {/* Sub-navegación vertical de la configuración */}
      <nav className="w-56 shrink-0 border-r border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Configuración
        </p>
        <ul className="space-y-1">
          {MENU.map((m) => (
            <li key={m.clave}>
              <button
                onClick={() => setSeccion(m.clave)}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                  seccion === m.clave
                    ? 'bg-marca-50 text-marca-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span aria-hidden className="text-base">
                  {m.icono}
                </span>
                {m.etiqueta}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Contenido de la sección activa */}
      <div className="min-w-0 flex-1 overflow-auto">
        {seccion === 'apariencia' && <Apariencia />}
        {seccion === 'asistente' && <AsistentePage />}
        {seccion === 'datos' && <DatosYCopias />}
      </div>
    </div>
  )
}

/** Contenedor común de una sección (título + descripción + contenido). */
function Seccion({
  titulo,
  descripcion,
  children
}: {
  titulo: string
  descripcion: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
      <p className="mt-1 text-sm text-slate-500">{descripcion}</p>
      <div className="mt-6">{children}</div>
    </div>
  )
}

// --- Apariencia ---

function Apariencia(): JSX.Element {
  const tema = useLayoutStore((s) => s.tema)
  const alternarTema = useLayoutStore((s) => s.alternarTema)
  const capaDocencia = useLayoutStore((s) => s.capaDocencia)
  const capaAprendizaje = useLayoutStore((s) => s.capaAprendizaje)
  const elegirCapas = useLayoutStore((s) => s.elegirCapas)

  return (
    <Seccion titulo="Apariencia" descripcion="Ajusta cómo se ve PedagoGraph.">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-800">Tema</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Elige entre el modo claro y el oscuro para trabajar cómodo.
          </p>
          <div className="mt-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <OpcionTema activo={tema === 'claro'} onClick={() => tema !== 'claro' && alternarTema()} icono="☀️" etiqueta="Claro" />
            <OpcionTema activo={tema === 'oscuro'} onClick={() => tema !== 'oscuro' && alternarTema()} icono="🌙" etiqueta="Oscuro" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-800">Secciones del menú</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Elige qué capas ver en el menú lateral. Debe quedar al menos una activa.
          </p>
          <div className="mt-3 space-y-2">
            <ToggleCapa
              icono="🎓"
              etiqueta="Docencia"
              descripcion="Asignaturas, temas y su material."
              activo={capaDocencia}
              // No permitas apagar la última capa activa.
              bloqueado={capaDocencia && !capaAprendizaje}
              onAlternar={() => elegirCapas(!capaDocencia, capaAprendizaje)}
            />
            <ToggleCapa
              icono="📘"
              etiqueta="Aprendizaje"
              descripcion="Espacios de estudio y repaso."
              activo={capaAprendizaje}
              bloqueado={capaAprendizaje && !capaDocencia}
              onAlternar={() => elegirCapas(capaDocencia, !capaAprendizaje)}
            />
          </div>
        </div>
      </div>
    </Seccion>
  )
}

function ToggleCapa({
  icono,
  etiqueta,
  descripcion,
  activo,
  bloqueado,
  onAlternar
}: {
  icono: string
  etiqueta: string
  descripcion: string
  activo: boolean
  bloqueado: boolean
  onAlternar: () => void
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
      <span aria-hidden className="text-lg">
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{etiqueta}</p>
        <p className="mt-0.5 text-xs text-slate-500">{descripcion}</p>
      </div>
      <button
        role="switch"
        aria-checked={activo}
        aria-label={etiqueta}
        onClick={onAlternar}
        disabled={bloqueado}
        title={bloqueado ? 'Debe quedar al menos una capa activa' : undefined}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
          activo ? 'bg-marca-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            activo ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}

function OpcionTema({
  activo,
  onClick,
  icono,
  etiqueta
}: {
  activo: boolean
  onClick: () => void
  icono: string
  etiqueta: string
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition ${
        activo ? 'bg-white text-marca-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <span aria-hidden>{icono}</span>
      {etiqueta}
    </button>
  )
}

// --- Datos y copias ---

function DatosYCopias(): JSX.Element {
  const cargarConceptos = useConceptosStore((s) => s.cargar)
  const cargarAsignaturas = useAsignaturasStore((s) => s.cargar)
  const notificar = useUiStore((s) => s.notificar)
  const notificarError = useUiStore((s) => s.notificarError)

  const [actualizando, setActualizando] = useState(false)
  const [respaldando, setRespaldando] = useState(false)
  const [restaurando, setRestaurando] = useState(false)
  const [confirmandoRestaurar, setConfirmandoRestaurar] = useState(false)

  const actualizar = async (): Promise<void> => {
    setActualizando(true)
    try {
      const r = await api.reindexar()
      await Promise.all([cargarConceptos(), cargarAsignaturas()])
      notificar({
        tipo: 'exito',
        mensaje: `Todo actualizado: ${r.conceptos} ${r.conceptos === 1 ? 'concepto' : 'conceptos'} y ${r.asignaturas} ${r.asignaturas === 1 ? 'asignatura' : 'asignaturas'}.`
      })
    } catch (error) {
      notificarError(error)
    } finally {
      setActualizando(false)
    }
  }

  const respaldar = async (): Promise<void> => {
    setRespaldando(true)
    try {
      const r = await api.respaldar()
      if (!r.cancelado) notificar({ tipo: 'exito', mensaje: 'Copia de seguridad guardada.' })
    } catch (error) {
      notificarError(error)
    } finally {
      setRespaldando(false)
    }
  }

  const restaurar = async (): Promise<void> => {
    setConfirmandoRestaurar(false)
    setRestaurando(true)
    try {
      const r = await api.restaurar()
      if (!r.cancelado) {
        await Promise.all([cargarConceptos(), cargarAsignaturas()])
        notificar({
          tipo: 'exito',
          mensaje: `Copia restaurada: ${r.conceptos ?? 0} ${r.conceptos === 1 ? 'concepto' : 'conceptos'}, ${r.asignaturas ?? 0} ${r.asignaturas === 1 ? 'asignatura' : 'asignaturas'} y ${r.tareas ?? 0} ${r.tareas === 1 ? 'tarea' : 'tareas'}.`
        })
      }
    } catch (error) {
      notificarError(error)
    } finally {
      setRestaurando(false)
    }
  }

  return (
    <Seccion
      titulo="Datos y copias"
      descripcion="Elige dónde se guarda tu material, actualízalo y gestiona tus copias de seguridad."
    >
      <div className="mb-8">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Dónde se guarda tu material</h2>
        <p className="mb-3 text-xs text-slate-500">
          Guárdalo en este equipo o en tu nube (Google Drive / OneDrive) para tenerlo disponible en
          todos tus dispositivos.
        </p>
        <AlmacenamientoNube />
      </div>
      <div className="space-y-3">
        <Fila
          icono="↻"
          titulo="Actualizar"
          descripcion="Vuelve a leer tu material y asignaturas desde el disco (reindexa)."
          boton={
            <Boton variante="secundario" onClick={() => void actualizar()} disabled={actualizando}>
              {actualizando ? 'Actualizando…' : 'Actualizar'}
            </Boton>
          }
        />
        <Fila
          icono="💾"
          titulo="Copia de seguridad"
          descripcion="Guarda todo tu material y asignaturas en un solo archivo, por seguridad."
          boton={
            <Boton variante="secundario" onClick={() => void respaldar()} disabled={respaldando}>
              {respaldando ? 'Guardando…' : 'Guardar copia'}
            </Boton>
          }
        />
        <Fila
          icono="♻️"
          titulo="Restaurar copia"
          descripcion="Recupera tu material y asignaturas desde un archivo de copia de seguridad."
          boton={
            <Boton variante="secundario" onClick={() => setConfirmandoRestaurar(true)} disabled={restaurando}>
              {restaurando ? 'Restaurando…' : 'Restaurar'}
            </Boton>
          }
        />
      </div>

      {confirmandoRestaurar && (
        <DialogoConfirmacion
          titulo="Restaurar copia de seguridad"
          mensaje="Elige tu archivo de copia (.zip). Su contenido se combinará con lo que ya tienes: los elementos con el mismo nombre se reemplazan y el resto se conserva."
          textoConfirmar="Elegir archivo…"
          textoOcupado="Restaurando…"
          onConfirmar={restaurar}
          onCancelar={() => setConfirmandoRestaurar(false)}
        />
      )}
    </Seccion>
  )
}

function Fila({
  icono,
  titulo,
  descripcion,
  boton
}: {
  icono: string
  titulo: string
  descripcion: string
  boton: ReactNode
}): JSX.Element {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <span aria-hidden className="text-xl">
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{titulo}</p>
        <p className="mt-0.5 text-xs text-slate-500">{descripcion}</p>
      </div>
      <div className="shrink-0">{boton}</div>
    </div>
  )
}

