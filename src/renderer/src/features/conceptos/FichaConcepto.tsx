import { useCallback, useEffect, useState } from 'react'
import type { FichaConceptoDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { DialogoConfirmacion } from '../../components/DialogoConfirmacion'
import { api } from '../../lib/api'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'
import { FormularioConcepto } from './FormularioConcepto'
import { ZonaMaterial } from './ZonaMaterial'

interface Props {
  conceptoId: string
}

export function FichaConcepto({ conceptoId }: Props): JSX.Element {
  const [ficha, setFicha] = useState<FichaConceptoDTO | null>(null)
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const volver = useUiStore((s) => s.seleccionarConcepto)
  const notificarError = useUiStore((s) => s.notificarError)
  const eliminar = useConceptosStore((s) => s.eliminar)

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

  const confirmarEliminar = async (): Promise<void> => {
    if (!ficha) return
    const ok = await eliminar(conceptoId, ficha.concepto.nombre)
    if (ok) volver(null)
  }

  if (cargando || !ficha) {
    return <p className="px-8 py-10 text-sm text-slate-400">Cargando…</p>
  }

  const { concepto, usos } = ficha

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

      {/* Material */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Material
        </h2>
        <ZonaMaterial
          conceptoId={concepto.id}
          recursos={concepto.recursos}
          onActualizado={(actualizado) =>
            setFicha((f) => (f ? { ...f, concepto: actualizado } : f))
          }
        />
      </section>

      {/* Se usa en */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Se usa en
        </h2>
        {usos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
            Este concepto todavía no se usa en ninguna asignatura.
          </p>
        ) : (
          <ul className="space-y-2">
            {usos.map((uso) => (
              <li
                key={`${uso.asignaturaId}-${uso.temaId}`}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700"
              >
                <span className="font-medium">
                  {uso.asignatura} {uso.periodo}
                </span>
                <span className="text-slate-400"> › {uso.unidad} › </span>
                <span>{uso.tema}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editando && (
        <FormularioConcepto
          conceptoInicial={{
            id: concepto.id,
            nombre: concepto.nombre,
            descripcion: concepto.descripcion
          }}
          onCerrar={() => setEditando(false)}
          onGuardado={() => void cargar()}
        />
      )}

      {confirmando && (
        <DialogoConfirmacion
          titulo={`¿Eliminar «${concepto.nombre}»?`}
          mensaje="Se borrará el concepto y todo su material. Esta acción no se puede deshacer."
          onConfirmar={confirmarEliminar}
          onCancelar={() => setConfirmando(false)}
        />
      )}
    </div>
  )
}
