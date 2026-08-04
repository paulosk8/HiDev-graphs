import { useCallback, useEffect, useState } from 'react'
import type { ResumenLienzoDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { DialogoConfirmacion } from '../../components/DialogoConfirmacion'
import { MenuContextual, useMenuContextual } from '../../components/MenuContextual'
import { api } from '../../lib/api'
import { useUiStore } from '../../stores/uiStore'
import { LienzoEditor } from './LienzoEditor'

/**
 * Sección «Lienzos»: la lista, y el editor cuando se abre uno.
 *
 * El lienzo es una VISTA sobre lo que ya existe: no guarda material ni notas,
 * solo qué tarjetas hay, dónde y cómo se conectan. Por eso se puede tener
 * varios del mismo contenido (uno por parcial, uno para una tutoría…).
 */
export function LienzoPage(): JSX.Element {
  const notificarError = useUiStore((s) => s.notificarError)
  const [lista, setLista] = useState<ResumenLienzoDTO[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [aEliminar, setAEliminar] = useState<ResumenLienzoDTO | null>(null)
  const { menu, abrir: abrirMenu, cerrar: cerrarMenu } = useMenuContextual<ResumenLienzoDTO>()

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setLista(await api.listarLienzos())
    } catch (error) {
      notificarError(error)
    } finally {
      setCargando(false)
    }
  }, [notificarError])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const crear = async (): Promise<void> => {
    const n = nombre.trim()
    if (!n) return
    try {
      const creado = await api.crearLienzo(n)
      setNombre('')
      setCreando(false)
      await cargar()
      // Se abre directamente: nadie crea un lienzo para no usarlo.
      setAbierto(creado.id)
    } catch (error) {
      notificarError(error)
    }
  }

  const eliminar = async (): Promise<void> => {
    if (!aEliminar) return
    try {
      await api.eliminarLienzo(aEliminar.id)
      setAEliminar(null)
      await cargar()
    } catch (error) {
      notificarError(error)
    }
  }

  if (abierto) {
    return (
      <LienzoEditor
        lienzoId={abierto}
        onVolver={() => {
          setAbierto(null)
          void cargar()
        }}
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Lienzos</h1>
          <p className="mt-1 max-w-prose text-sm text-slate-500">
            Mapas que organizas tú: coloca los conceptos que ya tienes y conéctalos como quieras.
            Puedes tener varios del mismo contenido, uno por cada cosa que prepares.
          </p>
        </div>
        {!creando && (
          <Boton variante="primario" onClick={() => setCreando(true)}>
            + Nuevo lienzo
          </Boton>
        )}
      </header>

      {creando && (
        <div className="mb-5 flex items-center gap-2">
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void crear()
              if (e.key === 'Escape') setCreando(false)
            }}
            placeholder="Nombre del lienzo (ej. Repaso del primer parcial)"
            maxLength={80}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
          />
          <Boton variante="primario" onClick={() => void crear()}>
            Crear
          </Boton>
          <Boton variante="secundario" onClick={() => setCreando(false)}>
            Cancelar
          </Boton>
        </div>
      )}

      {cargando ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
          Aún no tienes ningún lienzo.
        </p>
      ) : (
        <ul className="space-y-2">
          {lista.map((l) => (
            <li key={l.id}>
              <button
                onClick={() => setAbierto(l.id)}
                onContextMenu={(e) => abrirMenu(e, l)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-marca-300 hover:shadow-sm"
              >
                <span aria-hidden className="text-lg">
                  🗺️
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {l.nombre}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {l.totalTarjetas} {l.totalTarjetas === 1 ? 'tarjeta' : 'tarjetas'} ·{' '}
                    {l.totalConexiones} {l.totalConexiones === 1 ? 'conexión' : 'conexiones'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {menu && (
        <MenuContextual
          x={menu.x}
          y={menu.y}
          onCerrar={cerrarMenu}
          opciones={[
            { etiqueta: 'Abrir', icono: '↗', onElegir: () => setAbierto(menu.dato.id) },
            {
              etiqueta: 'Eliminar',
              icono: '✕',
              destructiva: true,
              onElegir: () => setAEliminar(menu.dato)
            }
          ]}
        />
      )}

      {aEliminar && (
        <DialogoConfirmacion
          titulo={`¿Eliminar «${aEliminar.nombre}»?`}
          mensaje="Se elimina solo el lienzo. Tus conceptos, notas y material NO se borran."
          onConfirmar={eliminar}
          onCancelar={() => setAEliminar(null)}
        />
      )}
    </div>
  )
}
