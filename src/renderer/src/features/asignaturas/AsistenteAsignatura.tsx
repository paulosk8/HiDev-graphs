import { useState } from 'react'
import {
  COMPONENTES_SUGERIDOS,
  type AsignaturaDTO,
  type ComponenteDTO,
  type DatosAsignaturaDTO,
  type TipoAsignatura
} from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { CampoTexto } from '../../components/Campos'
import { Modal } from '../../components/Modal'
import { useAsignaturasStore } from '../../stores/asignaturasStore'

interface Props {
  /** 'docencia' (asignatura) o 'aprendizaje' (workspace de estudio). Se ignora al editar. */
  tipo?: TipoAsignatura
  /** Si se pasa, edita esa asignatura en vez de crear una nueva. */
  asignaturaExistente?: AsignaturaDTO
  onCerrar: () => void
  /** Se llama con el id tras crear o guardar. */
  onCreada: (id: string) => void
}

/**
 * Formulario para crear o editar una asignatura (docencia) o un espacio de
 * aprendizaje. Solo pide lo esencial: nombre y —en docencia— períodos y
 * componentes. El contenido (temas y subtemas) se agrega/edita luego **inline**
 * en la ficha, así que aquí no hay paso de contenido.
 */
export function AsistenteAsignatura({
  tipo = 'docencia',
  asignaturaExistente,
  onCerrar,
  onCreada
}: Props): JSX.Element {
  const crear = useAsignaturasStore((s) => s.crear)
  const editar = useAsignaturasStore((s) => s.editar)
  const modoEdicion = !!asignaturaExistente
  const esAprendizaje = (asignaturaExistente?.tipo ?? tipo) === 'aprendizaje'

  const [ocupado, setOcupado] = useState(false)
  const [nombre, setNombre] = useState(asignaturaExistente?.nombre ?? '')
  const [periodos, setPeriodos] = useState<string[]>(asignaturaExistente?.periodos ?? [])
  const [periodoNuevo, setPeriodoNuevo] = useState('')
  const [componentes, setComponentes] = useState<ComponenteDTO[]>(
    asignaturaExistente
      ? asignaturaExistente.componentes.map((c) => ({ clave: c.clave, nombre: c.nombre }))
      : esAprendizaje
        ? []
        : [...COMPONENTES_SUGERIDOS]
  )
  const [claveNueva, setClaveNueva] = useState('')
  const [nombreNuevo, setNombreNuevo] = useState('')

  // --- Períodos ---
  const agregarPeriodo = (): void => {
    const p = periodoNuevo.trim()
    if (p && !periodos.includes(p)) setPeriodos((prev) => [...prev, p])
    setPeriodoNuevo('')
  }
  const quitarPeriodo = (p: string): void => setPeriodos((prev) => prev.filter((x) => x !== p))

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

  const datosCompletos = nombre.trim().length > 0 && (esAprendizaje || periodos.length > 0)

  const finalizar = async (): Promise<void> => {
    if (!datosCompletos) return
    setOcupado(true)

    if (modoEdicion && asignaturaExistente) {
      // Sin `unidades`: se conserva la estructura (se edita inline en la ficha).
      const editada = await editar(asignaturaExistente.id, {
        nombre: nombre.trim(),
        periodos,
        componentes
      })
      setOcupado(false)
      if (editada) {
        onCreada(editada.id)
        onCerrar()
      }
      return
    }

    const datos: DatosAsignaturaDTO = {
      nombre: nombre.trim(),
      tipo,
      periodos: esAprendizaje ? [] : periodos,
      componentes: esAprendizaje ? [] : componentes,
      unidades: [] // el contenido se agrega inline después
    }
    const creada = await crear(datos)
    setOcupado(false)
    if (creada) {
      onCreada(creada.id)
      onCerrar()
    }
  }

  return (
    <Modal
      titulo={
        modoEdicion
          ? esAprendizaje
            ? 'Editar espacio de aprendizaje'
            : 'Editar asignatura'
          : esAprendizaje
            ? 'Nuevo espacio para aprender'
            : 'Nueva asignatura'
      }
      ancho="lg"
      onCerrar={onCerrar}
    >
      <div className="space-y-4">
        <CampoTexto
          etiqueta={esAprendizaje ? '¿Qué quieres aprender?' : 'Nombre de la asignatura'}
          placeholder={esAprendizaje ? 'Ej. Programar en React' : 'Ej. Algoritmos'}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus
        />

        {esAprendizaje ? (
          <p className="text-sm text-slate-500">
            Registra el tema que quieres aprender. Después organizas sus subtemas y les agregas
            material desde su ficha.
          </p>
        ) : (
          <>
            {/* Períodos */}
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
                Puedes añadir varios: la misma asignatura se dicta en todos ellos.
              </span>
            </div>

            {/* Componentes */}
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Componentes de aprendizaje
              </span>
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
                <div className="mt-2 flex flex-wrap gap-2">
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

              <div className="mt-3 flex items-end gap-2 border-t border-slate-100 pt-3">
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
          </>
        )}
      </div>

      {/* Pie */}
      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
        <Boton variante="fantasma" onClick={onCerrar} disabled={ocupado}>
          Cancelar
        </Boton>
        <Boton variante="primario" onClick={finalizar} disabled={ocupado || !datosCompletos}>
          {ocupado
            ? modoEdicion
              ? 'Guardando…'
              : 'Creando…'
            : modoEdicion
              ? 'Guardar cambios'
              : esAprendizaje
                ? 'Crear espacio'
                : 'Crear asignatura'}
        </Boton>
      </div>
    </Modal>
  )
}
