import { ipcMain } from 'electron'

import { CANALES } from '../../shared/canales'
import type { SesionDTO } from '../../shared/dtos'
import type { SupabaseAuthService } from '../infrastructure/SupabaseAuthService'
import { envolver } from './registrarHandlers'

/** Conecta los canales de autenticación con el servicio de Supabase. */
export function registrarHandlersAuth(auth: SupabaseAuthService): void {
  ipcMain.handle(CANALES.authIniciar, () => envolver<SesionDTO>(() => auth.iniciarSesion()))
  ipcMain.handle(CANALES.authCerrar, () => envolver<null>(async () => {
    await auth.cerrarSesion()
    return null
  }))
  ipcMain.handle(CANALES.authSesion, () => envolver<SesionDTO | null>(() => auth.obtenerSesion()))
}
