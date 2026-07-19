import { useEffect, useState } from 'react'
import type { AlmacenamientoDTO, CarpetaNubeDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { useUiStore } from '../../stores/uiStore'
import { DialogoGuardarNube } from './DialogoGuardarNube'

/**
 * "Dónde se guarda tu material": elegir entre este equipo o crear una carpeta en
 * la nube (Google Drive / OneDrive), al estilo de Obsidian — eliges ubicación y
 * nombre. Al cambiar, la app copia el material (sin borrar el origen) y recarga.
 */
export function AlmacenamientoNube(): JSX.Element {
  const notificar = useUiStore((s) => s.notificar)
  const notificarError = useUiStore((s) => s.notificarError)

  const [estado, setEstado] = useState<AlmacenamientoDTO | null>(null)
  const [carpetas, setCarpetas] = useState<CarpetaNubeDTO[]>([])
  const [cargando, setCargando] = useState(true)
  const [abrirNube, setAbrirNube] = useState(false)
  const [confirmandoLocal, setConfirmandoLocal] = useState(false)
  const [moviendo, setMoviendo] = useState(false)

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const [e, c] = await Promise.all([
          api.estadoAlmacenamiento(),
          api.detectarCarpetasNube()
        ])
        if (!vivo) return
        setEstado(e)
        setCarpetas(c)
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

  const usarLocal = async (): Promise<void> => {
    setMoviendo(true)
    try {
      const r = await api.usarAlmacenamientoLocal()
      setConfirmandoLocal(false)
      if (r.sinCambios) {
        notificar({ tipo: 'info', mensaje: 'Tu material ya se guarda en este equipo.' })
        setMoviendo(false)
      } else {
        // El proceso principal aplica el cambio y recarga la ventana enseguida.
        notificar({ tipo: 'exito', mensaje: 'Listo. Aplicando el cambio…' })
      }
    } catch (error) {
      notificarError(error)
      setConfirmandoLocal(false)
      setMoviendo(false)
    }
  }

  if (cargando) {
    return <p className="text-sm text-slate-500">Cargando…</p>
  }

  return (
    <div className="space-y-4">
      {/* Estado actual, en lenguaje del docente */}
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <span aria-hidden className="text-2xl">
          {estado?.modo === 'nube' ? '☁️' : '💻'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">
            Tu material se guarda en {estado?.nombreVisible ?? 'este equipo'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {estado?.modo === 'nube'
              ? 'Se sincroniza automáticamente con tu nube y estará disponible en tus otros equipos.'
              : 'Solo en este equipo. No se sincroniza con tus otros dispositivos.'}
          </p>
        </div>
      </div>

      {/* Opciones de destino */}
      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Cambiar dónde se guarda
        </p>

        <OpcionAlmacenamiento
          icono="💻"
          titulo="Este equipo"
          descripcion="Guarda tu material en la carpeta Documentos de este ordenador."
          actual={estado?.modo === 'local'}
          onElegir={() => setConfirmandoLocal(true)}
        />

        <OpcionAlmacenamiento
          icono="☁️"
          titulo="En mi nube (Google Drive / OneDrive)"
          descripcion="Elige la ubicación y crea la carpeta. Tu nube lo sincroniza entre tus equipos."
          actual={estado?.modo === 'nube'}
          onElegir={() => setAbrirNube(true)}
        />
      </div>

      {confirmandoLocal && (
        <Modal
          titulo="Guardar tu material en este equipo"
          descripcion="Copiaremos tu material a la carpeta Documentos de este equipo y la vista se actualizará. Tu copia anterior se conservará como respaldo."
          onCerrar={() => !moviendo && setConfirmandoLocal(false)}
        >
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setConfirmandoLocal(false)} disabled={moviendo}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={() => void usarLocal()} disabled={moviendo}>
              {moviendo ? 'Guardando…' : 'Guardar y aplicar'}
            </Boton>
          </div>
        </Modal>
      )}

      {abrirNube && (
        <DialogoGuardarNube carpetas={carpetas} onCerrar={() => setAbrirNube(false)} />
      )}
    </div>
  )
}

function OpcionAlmacenamiento({
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
    <div
      className={`flex items-center gap-4 rounded-xl border p-4 ${
        actual ? 'border-marca-300 bg-marca-50' : 'border-slate-200 bg-white'
      }`}
    >
      <span aria-hidden className="text-xl">
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{titulo}</p>
        <p className="mt-0.5 text-xs text-slate-500">{descripcion}</p>
      </div>
      <div className="shrink-0">
        {actual ? (
          <span className="rounded-full bg-marca-100 px-3 py-1 text-xs font-medium text-marca-700">
            Actual
          </span>
        ) : (
          <Boton variante="secundario" onClick={onElegir}>
            {titulo.startsWith('En mi nube') ? 'Elegir…' : 'Usar'}
          </Boton>
        )}
      </div>
    </div>
  )
}
