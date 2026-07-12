import { useState, type FormEvent } from 'react'
import { Boton } from '../../components/Boton'
import { CampoArea, CampoTexto } from '../../components/Campos'
import { Modal } from '../../components/Modal'
import { useConceptosStore } from '../../stores/conceptosStore'

interface ConceptoInicial {
  id: string
  nombre: string
  descripcion: string
}

interface Props {
  conceptoInicial?: ConceptoInicial
  onCerrar: () => void
  onGuardado?: (id: string) => void
}

/**
 * Formulario mínimo (2 campos) para crear o editar un concepto. Si recibe
 * `conceptoInicial`, funciona en modo edición.
 */
export function FormularioConcepto({ conceptoInicial, onCerrar, onGuardado }: Props): JSX.Element {
  const editando = conceptoInicial !== undefined
  const [nombre, setNombre] = useState(conceptoInicial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(conceptoInicial?.descripcion ?? '')
  const [ocupado, setOcupado] = useState(false)

  const crear = useConceptosStore((s) => s.crear)
  const editar = useConceptosStore((s) => s.editar)

  const guardar = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (nombre.trim().length === 0) return
    setOcupado(true)
    const datos = { nombre: nombre.trim(), descripcion: descripcion.trim() }
    const resultado = editando
      ? await editar(conceptoInicial.id, datos)
      : await crear(datos)
    setOcupado(false)
    if (resultado) {
      onGuardado?.(resultado.id)
      onCerrar()
    }
  }

  return (
    <Modal
      titulo={editando ? 'Editar concepto' : 'Nuevo concepto'}
      descripcion={
        editando ? undefined : 'Un concepto es una idea reutilizable entre tus asignaturas.'
      }
      onCerrar={onCerrar}
    >
      <form onSubmit={guardar} className="space-y-4">
        <CampoTexto
          etiqueta="Nombre"
          placeholder="Ej. Divide y vencerás"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus
          maxLength={120}
        />
        <CampoArea
          etiqueta="Descripción (opcional)"
          placeholder="¿De qué trata este concepto?"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          maxLength={500}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" disabled={ocupado || nombre.trim().length === 0}>
            {ocupado ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
