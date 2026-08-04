import { ipcMain, shell } from 'electron'
import { mkdirSync } from 'node:fs'

import { CANALES } from '../../shared/canales'
import type { EliminacionDTO, ModoEliminacion } from '../../shared/dtos'
import { guardarConfigApp, leerConfigApp } from '../infrastructure/configApp'
import { hayEliminados, modoEliminacionDesde, vaciarEliminados } from '../infrastructure/Papelera'
import type { VaultFileSystemService } from '../infrastructure/VaultFileSystemService'
import { envolver } from './registrarHandlers'

/**
 * Canales de la preferencia "qué pasa al eliminar": mover a la carpeta
 * "Eliminados" del material (recuperable) o borrar definitivamente.
 *
 * La preferencia vive en la config por-equipo y el vault la lee en CADA
 * borrado, así que cambiarla surte efecto sin reiniciar la app.
 */
export function registrarHandlersEliminacion(vault: VaultFileSystemService): void {
  const estado = (): EliminacionDTO => ({
    modo: leerConfigApp().modoEliminacion,
    ruta: vault.dirEliminados,
    hayEliminados: hayEliminados(vault.dirEliminados)
  })

  ipcMain.handle(CANALES.eliminacionEstado, () => envolver<EliminacionDTO>(() => estado()))

  ipcMain.handle(CANALES.eliminacionFijarModo, (_evento, modo: ModoEliminacion) =>
    envolver<EliminacionDTO>(() => {
      guardarConfigApp({ ...leerConfigApp(), modoEliminacion: modoEliminacionDesde(modo) })
      return estado()
    })
  )

  ipcMain.handle(CANALES.eliminacionAbrirCarpeta, () =>
    envolver<void>(async () => {
      // Puede no existir todavía (aún no se ha eliminado nada): se crea para
      // que el docente vea una carpeta vacía en vez de un error del sistema.
      mkdirSync(vault.dirEliminados, { recursive: true })
      const error = await shell.openPath(vault.dirEliminados)
      if (error) throw new Error(error)
    })
  )

  ipcMain.handle(CANALES.eliminacionVaciar, () =>
    envolver<EliminacionDTO>(() => {
      vaciarEliminados(vault.dirEliminados)
      return estado()
    })
  )
}
