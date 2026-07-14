import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'

/**
 * Estado de conexión del equipo (`navigator.onLine`), reactivo a los eventos
 * `online`/`offline` del navegador. Se usa para mostrar un aviso "sin conexión".
 */
export function useEnLinea(): boolean {
  const [enLinea, setEnLinea] = useState<boolean>(() => navigator.onLine)
  useEffect(() => {
    const alConectar = (): void => setEnLinea(true)
    const alDesconectar = (): void => setEnLinea(false)
    window.addEventListener('online', alConectar)
    window.addEventListener('offline', alDesconectar)
    return () => {
      window.removeEventListener('online', alConectar)
      window.removeEventListener('offline', alDesconectar)
    }
  }, [])
  return enLinea
}

/**
 * Sincroniza con la nube si hay sesión iniciada. Pensada para dispararse al
 * recuperar la conexión: sube los cambios hechos offline sin esperar a un nuevo
 * cambio local, reinicio o al botón manual. Silenciosa (los errores no molestan).
 */
export function sincronizarSiEnLinea(): void {
  const estado = useAuthStore.getState()
  if (estado.sesion) void estado.sincronizar().catch(() => undefined)
}

/**
 * Al recuperar la conexión (`online`), sincroniza en segundo plano. Complementa
 * el auto-sync por cambios locales y el sync de arranque/login/botón.
 */
export function useSincronizarAlReconectar(): void {
  useEffect(() => {
    window.addEventListener('online', sincronizarSiEnLinea)
    return () => window.removeEventListener('online', sincronizarSiEnLinea)
  }, [])
}
