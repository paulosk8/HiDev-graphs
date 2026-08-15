import { useState } from 'react'
import type { EnlaceMaterialDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { CampoTexto } from '../../components/Campos'
import { Modal } from '../../components/Modal'

interface Props {
  /** Enlace a editar, o null para agregar uno nuevo. */
  enlace: EnlaceMaterialDTO | null
  /** Carpeta donde caerá el enlace nuevo (solo para el texto de ayuda). */
  carpeta?: string
  onGuardar: (datos: { titulo: string; url: string }) => Promise<void>
  onCerrar: () => void
}

/**
 * Alta y edición de un enlace web del material.
 *
 * Pide la dirección primero y el nombre después: la dirección es lo que el
 * docente trae en el portapapeles, y el nombre es opcional (si lo deja en
 * blanco se usa la propia dirección).
 */
export function DialogoEnlace({ enlace, carpeta, onGuardar, onCerrar }: Props): JSX.Element {
  const [url, setUrl] = useState(enlace?.url ?? '')
  // Un enlace sin nombre propio guarda la dirección como título; en ese caso el
  // campo se muestra vacío para que no parezca que hay que borrarlo a mano.
  const [titulo, setTitulo] = useState(
    enlace && enlace.titulo !== enlace.url ? enlace.titulo : ''
  )
  const [guardando, setGuardando] = useState(false)

  const enviar = async (): Promise<void> => {
    if (!url.trim() || guardando) return
    setGuardando(true)
    try {
      await onGuardar({ titulo: titulo.trim(), url: url.trim() })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      titulo={enlace ? 'Editar el enlace' : 'Agregar un enlace web'}
      descripcion={
        enlace
          ? undefined
          : carpeta
            ? `Se guardará en la carpeta «${carpeta}», junto al resto del material.`
            : 'Una página, un vídeo o un simulador. Aparecerá junto al resto del material del concepto.'
      }
      onCerrar={onCerrar}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <CampoTexto
          etiqueta="Dirección de la página"
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="www.khanacademy.org/computing"
          ayuda="Pégala tal cual; no hace falta escribir https://"
        />
        <CampoTexto
          etiqueta="Nombre (opcional)"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Vídeo: estructuras de datos en 10 minutos"
          ayuda="Cómo quieres verlo en tu lista de material."
        />
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" disabled={!url.trim() || guardando}>
            {guardando ? 'Guardando…' : enlace ? 'Guardar' : 'Agregar'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
