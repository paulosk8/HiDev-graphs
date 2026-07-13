import { ipcMain } from 'electron'

import { CANALES } from '../../shared/canales'
import type { SincronizacionDTO } from '../../shared/dtos'
import type { SyncService } from '../infrastructure/SyncService'
import { envolver } from './registrarHandlers'

/** Conecta el canal de sincronización con el servicio de nube. */
export function registrarHandlersNube(sync: SyncService): void {
  ipcMain.handle(CANALES.nubeSincronizar, () =>
    envolver<SincronizacionDTO>(() => sync.sincronizar())
  )
}
