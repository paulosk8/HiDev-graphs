import { useState } from 'react'
import { api } from '../lib/api'
import { DialogoConfirmacion } from './DialogoConfirmacion'
import { useAuthStore } from '../stores/authStore'
import { useAsignaturasStore } from '../stores/asignaturasStore'
import { useConceptosStore } from '../stores/conceptosStore'
import { useLayoutStore } from '../stores/layoutStore'
import { useUiStore, type Seccion } from '../stores/uiStore'

interface ItemProps {
  seccion: Seccion
  etiqueta: string
  cuenta?: number
  icono: string
  colapsada: boolean
}

function Item({ seccion, etiqueta, cuenta, icono, colapsada }: ItemProps): JSX.Element {
  const activo = useUiStore((s) => s.seccion === seccion)
  const irASeccion = useUiStore((s) => s.irASeccion)

  return (
    <button
      onClick={() => irASeccion(seccion)}
      title={colapsada ? etiqueta : undefined}
      className={`flex w-full items-center rounded-md text-sm font-medium transition ${
        colapsada ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'
      } ${activo ? 'bg-marca-50 text-marca-700' : 'text-slate-600 hover:bg-slate-100'}`}
    >
      <span aria-hidden className="text-base">
        {icono}
      </span>
      {!colapsada && (
        <>
          <span className="flex-1 text-left">{etiqueta}</span>
          {cuenta !== undefined && (
            <span className={`text-xs ${activo ? 'text-marca-500' : 'text-slate-400'}`}>{cuenta}</span>
          )}
        </>
      )}
    </button>
  )
}

export function Sidebar(): JSX.Element {
  const totalConceptos = useConceptosStore((s) => s.lista.length)
  const totalAsignaturas = useAsignaturasStore((s) => s.lista.length)
  const cargarConceptos = useConceptosStore((s) => s.cargar)
  const cargarAsignaturas = useAsignaturasStore((s) => s.cargar)
  const notificar = useUiStore((s) => s.notificar)
  const notificarError = useUiStore((s) => s.notificarError)
  const colapsada = useLayoutStore((s) => s.sidebarColapsada)
  const alternar = useLayoutStore((s) => s.alternarSidebar)
  const usuario = useAuthStore((s) => s.sesion?.usuario)
  const cerrarSesion = useAuthStore((s) => s.cerrar)
  const tema = useLayoutStore((s) => s.tema)
  const alternarTema = useLayoutStore((s) => s.alternarTema)
  const [actualizando, setActualizando] = useState(false)
  const [respaldando, setRespaldando] = useState(false)
  const [restaurando, setRestaurando] = useState(false)
  const [confirmandoRestaurar, setConfirmandoRestaurar] = useState(false)

  const respaldar = async (): Promise<void> => {
    setRespaldando(true)
    try {
      const r = await api.respaldar()
      if (!r.cancelado) {
        notificar({ tipo: 'exito', mensaje: 'Copia de seguridad guardada.' })
      }
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

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-slate-200 bg-slate-50 p-3 transition-all ${
        colapsada ? 'w-16 items-center' : 'w-64 p-4'
      }`}
    >
      <div className={`mb-8 flex items-center ${colapsada ? 'justify-center' : 'gap-2 px-2'}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-marca-600 text-sm font-bold text-white">
          P
        </div>
        {!colapsada && (
          <>
            <span className="text-lg font-semibold text-slate-800">PedagoGraph</span>
            <button
              onClick={alternar}
              title="Contraer el menú"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
            >
              «
            </button>
          </>
        )}
      </div>

      {colapsada && (
        <button
          onClick={alternar}
          title="Expandir el menú"
          className="mb-3 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
        >
          »
        </button>
      )}

      <nav className="w-full space-y-1">
        <Item seccion="asignaturas" etiqueta="Mis asignaturas" cuenta={colapsada ? undefined : totalAsignaturas} icono="🎓" colapsada={colapsada} />
        <Item seccion="conceptos" etiqueta="Conceptos" cuenta={colapsada ? undefined : totalConceptos} icono="💡" colapsada={colapsada} />
        <Item seccion="grafo" etiqueta="Mapa de conceptos" icono="🕸️" colapsada={colapsada} />
        <Item seccion="asistente" etiqueta="Asistente IA" icono="🤖" colapsada={colapsada} />
      </nav>

      <div className="mt-auto w-full space-y-2">
        <button
          onClick={alternarTema}
          title={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className={`flex w-full items-center rounded-md text-sm text-slate-500 transition hover:bg-slate-100 ${
            colapsada ? 'justify-center px-0 py-2.5' : 'gap-2 px-3 py-2'
          }`}
        >
          <span aria-hidden>{tema === 'oscuro' ? '☀️' : '🌙'}</span>
          {!colapsada && (tema === 'oscuro' ? 'Modo claro' : 'Modo oscuro')}
        </button>
        <button
          onClick={() => void actualizar()}
          disabled={actualizando}
          title="Vuelve a leer tu material y asignaturas desde el disco"
          className={`flex w-full items-center rounded-md text-sm text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 ${
            colapsada ? 'justify-center px-0 py-2.5' : 'gap-2 px-3 py-2'
          }`}
        >
          <span aria-hidden className={actualizando ? 'animate-spin' : ''}>
            ↻
          </span>
          {!colapsada && (actualizando ? 'Actualizando…' : 'Actualizar')}
        </button>
        <button
          onClick={() => void respaldar()}
          disabled={respaldando}
          title="Guarda todo tu material y asignaturas en un solo archivo, por seguridad"
          className={`flex w-full items-center rounded-md text-sm text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 ${
            colapsada ? 'justify-center px-0 py-2.5' : 'gap-2 px-3 py-2'
          }`}
        >
          <span aria-hidden>💾</span>
          {!colapsada && (respaldando ? 'Guardando…' : 'Copia de seguridad')}
        </button>
        <button
          onClick={() => setConfirmandoRestaurar(true)}
          disabled={restaurando}
          title="Recupera tu material y asignaturas desde un archivo de copia de seguridad"
          className={`flex w-full items-center rounded-md text-sm text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 ${
            colapsada ? 'justify-center px-0 py-2.5' : 'gap-2 px-3 py-2'
          }`}
        >
          <span aria-hidden>♻️</span>
          {!colapsada && (restaurando ? 'Restaurando…' : 'Restaurar copia')}
        </button>
        {usuario && (
          <div className={`mt-1 flex items-center border-t border-slate-100 pt-2 ${colapsada ? 'justify-center' : 'gap-2 px-1'}`}>
            {usuario.foto ? (
              <img src={usuario.foto} alt="" className="h-7 w-7 shrink-0 rounded-full" />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marca-100 text-xs font-semibold text-marca-700">
                {usuario.nombre.charAt(0).toUpperCase()}
              </span>
            )}
            {!colapsada && (
              <>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500" title={usuario.email}>
                  {usuario.nombre}
                </span>
                <button
                  onClick={() => void cerrarSesion()}
                  title="Cerrar sesión"
                  className="shrink-0 rounded-md px-1.5 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
                >
                  Salir
                </button>
              </>
            )}
          </div>
        )}
        {!colapsada && <div className="px-2 text-xs text-slate-400">PedagoGraph · versión 0.1.0</div>}
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
    </aside>
  )
}
