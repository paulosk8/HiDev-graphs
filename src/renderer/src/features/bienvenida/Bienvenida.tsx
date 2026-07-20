import { useEffect, useState } from 'react'
import type { CarpetaNubeDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { api } from '../../lib/api'
import { useUiStore } from '../../stores/uiStore'
import { DialogoGuardarNube } from '../configuracion/DialogoGuardarNube'

/**
 * Pantalla de bienvenida al primer arranque (estilo Obsidian): el docente elige
 * dónde guardar su material —en este equipo o en su nube— antes de entrar. Solo
 * se muestra cuando la app aún no está configurada.
 *
 * `onListo` se llama cuando la elección no recarga la ventana (p. ej. "este
 * equipo", que ya es la carpeta por defecto): así la app entra sin recargar.
 */
export function Bienvenida({ onListo }: { onListo: () => void }): JSX.Element {
  const notificarError = useUiStore((s) => s.notificarError)
  const [carpetas, setCarpetas] = useState<CarpetaNubeDTO[]>([])
  const [abrirNube, setAbrirNube] = useState(false)
  const [empezando, setEmpezando] = useState(false)

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const c = await api.detectarCarpetasNube()
        if (vivo) setCarpetas(c)
      } catch (error) {
        if (vivo) notificarError(error)
      }
    })()
    return () => {
      vivo = false
    }
  }, [notificarError])

  const empezarEnEsteEquipo = async (): Promise<void> => {
    setEmpezando(true)
    try {
      const r = await api.usarAlmacenamientoLocal()
      // Si ya estaba en este equipo no hay recarga: entramos nosotros.
      if (r.sinCambios) onListo()
      // Si hubo cambio, el proceso principal recarga la ventana y entra solo.
    } catch (error) {
      notificarError(error)
      setEmpezando(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-marca-600 text-2xl font-bold text-white">
            P
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Te damos la bienvenida a PedagoGraph</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Para empezar, elige dónde quieres guardar tu material. Podrás cambiarlo cuando quieras.
          </p>
        </div>

        <div className="space-y-3">
          <OpcionBienvenida
            icono="💻"
            titulo="En este equipo"
            descripcion="Se guarda en la carpeta Documentos de este ordenador. Rápido y sin cuentas."
            accion={
              <Boton variante="secundario" onClick={() => void empezarEnEsteEquipo()} disabled={empezando}>
                {empezando ? 'Preparando…' : 'Empezar aquí'}
              </Boton>
            }
          />
          <OpcionBienvenida
            icono="☁️"
            titulo="En mi nube (Google Drive / OneDrive)"
            descripcion="Elige la ubicación y crea la carpeta. Tu nube lo sincroniza entre tus equipos."
            accion={
              <Boton variante="primario" onClick={() => setAbrirNube(true)} disabled={empezando}>
                Elegir…
              </Boton>
            }
          />
        </div>
      </div>

      {abrirNube && (
        <DialogoGuardarNube
          carpetas={carpetas}
          onCerrar={() => setAbrirNube(false)}
          onListo={onListo}
        />
      )}
    </div>
  )
}

function OpcionBienvenida({
  icono,
  titulo,
  descripcion,
  accion
}: {
  icono: string
  titulo: string
  descripcion: string
  accion: JSX.Element
}): JSX.Element {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-4">
      <span aria-hidden className="text-2xl">
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{titulo}</p>
        <p className="mt-0.5 text-xs text-slate-500">{descripcion}</p>
      </div>
      <div className="shrink-0">{accion}</div>
    </div>
  )
}
