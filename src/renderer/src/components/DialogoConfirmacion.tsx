import { useState } from 'react'
import { Boton } from './Boton'
import { Modal } from './Modal'

interface Props {
  titulo: string
  mensaje: string
  textoConfirmar?: string
  onConfirmar: () => void | Promise<void>
  onCancelar: () => void
}

/** Diálogo de confirmación para acciones irreversibles (p. ej. eliminar). */
export function DialogoConfirmacion({
  titulo,
  mensaje,
  textoConfirmar = 'Eliminar',
  onConfirmar,
  onCancelar
}: Props): JSX.Element {
  const [ocupado, setOcupado] = useState(false)

  const confirmar = async (): Promise<void> => {
    setOcupado(true)
    try {
      await onConfirmar()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Modal titulo={titulo} descripcion={mensaje} onCerrar={onCancelar}>
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </Boton>
        <Boton variante="peligro" onClick={confirmar} disabled={ocupado}>
          {ocupado ? 'Eliminando…' : textoConfirmar}
        </Boton>
      </div>
    </Modal>
  )
}
