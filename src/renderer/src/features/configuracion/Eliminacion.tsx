import { useEffect, useState } from 'react'
import type { EliminacionDTO, ModoEliminacion } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { DialogoConfirmacion } from '../../components/DialogoConfirmacion'
import { api } from '../../lib/api'
import { useEliminacionStore } from '../../stores/eliminacionStore'
import { useUiStore } from '../../stores/uiStore'

/**
 * "Cuando elimino algo": al estilo de Obsidian, el docente decide si lo que
 * borra se guarda en una carpeta de eliminados (recuperable) o desaparece.
 *
 * La carpeta vive DENTRO de la carpeta del material, así que si el material está
 * en la nube lo eliminado también viaja y se puede recuperar desde otro equipo.
 */
export function Eliminacion(): JSX.Element {
  const notificar = useUiStore((s) => s.notificar)
  const notificarError = useUiStore((s) => s.notificarError)
  const fijarEnStore = useEliminacionStore((s) => s.fijar)

  const [estado, setEstado] = useState<EliminacionDTO | null>(null)
  const [cargando, setCargando] = useState(true)
  const [confirmandoVaciar, setConfirmandoVaciar] = useState(false)

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const e = await api.estadoEliminacion()
        if (vivo) setEstado(e)
      } catch (error) {
        if (vivo) notificarError(error)
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [notificarError])

  const elegir = async (modo: ModoEliminacion): Promise<void> => {
    if (estado?.modo === modo) return
    try {
      setEstado(await api.fijarModoEliminacion(modo))
      // Para que los diálogos de confirmación cambien su aviso al instante.
      fijarEnStore(modo)
      notificar({
        tipo: 'exito',
        mensaje:
          modo === 'papelera'
            ? 'A partir de ahora lo que elimines se guardará en la carpeta de eliminados.'
            : 'A partir de ahora lo que elimines se borrará definitivamente.'
      })
    } catch (error) {
      notificarError(error)
    }
  }

  const abrirCarpeta = async (): Promise<void> => {
    try {
      await api.abrirCarpetaEliminados()
    } catch (error) {
      notificarError(error)
    }
  }

  const vaciar = async (): Promise<void> => {
    try {
      setEstado(await api.vaciarEliminados())
      setConfirmandoVaciar(false)
      notificar({ tipo: 'exito', mensaje: 'Se vació la carpeta de eliminados.' })
    } catch (error) {
      notificarError(error)
      setConfirmandoVaciar(false)
    }
  }

  if (cargando) return <p className="text-sm text-slate-500">Cargando…</p>

  const enPapelera = estado?.modo === 'papelera'

  return (
    <div className="space-y-2">
      <Opcion
        icono="🗂️"
        titulo="Guardarlo por si acaso"
        descripcion="Lo que elimines se mueve a una carpeta “Eliminados”, junto a tu material. Podrás recuperarlo."
        actual={enPapelera}
        onElegir={() => void elegir('papelera')}
      />
      <Opcion
        icono="🗑️"
        titulo="Eliminarlo definitivamente"
        descripcion="Lo que elimines desaparece del disco. No se puede deshacer."
        actual={estado?.modo === 'permanente'}
        onElegir={() => void elegir('permanente')}
      />

      {enPapelera && (
        <div className="flex items-center gap-2 px-1 pt-1">
          <Boton variante="secundario" onClick={() => void abrirCarpeta()}>
            Abrir la carpeta de eliminados
          </Boton>
          {estado?.hayEliminados && (
            <Boton variante="secundario" onClick={() => setConfirmandoVaciar(true)}>
              Vaciar
            </Boton>
          )}
        </div>
      )}

      {confirmandoVaciar && (
        <DialogoConfirmacion
          titulo="Vaciar la carpeta de eliminados"
          mensaje="Se borrará definitivamente todo lo que habías eliminado. Esta acción no se puede deshacer."
          textoConfirmar="Vaciar"
          textoOcupado="Vaciando…"
          onConfirmar={vaciar}
          onCancelar={() => setConfirmandoVaciar(false)}
        />
      )}
    </div>
  )
}

function Opcion({
  icono,
  titulo,
  descripcion,
  actual,
  onElegir
}: {
  icono: string
  titulo: string
  descripcion: string
  actual: boolean
  onElegir: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-pressed={actual}
      className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
        actual
          ? 'border-marca-300 bg-marca-50'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <span aria-hidden className="text-xl">
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{titulo}</p>
        <p className="mt-0.5 text-xs text-slate-500">{descripcion}</p>
      </div>
      {actual && (
        <span className="shrink-0 rounded-full bg-marca-100 px-3 py-1 text-xs font-medium text-marca-700">
          Actual
        </span>
      )}
    </button>
  )
}
