import { ipcMain } from 'electron'

import { CANALES } from '../../shared/canales'
import type { ItemHistorialDTO, TablaHistorial, VersionHistorialDTO } from '../../shared/dtos'
import type { HistorialService } from '../infrastructure/HistorialService'
import { envolver } from './registrarHandlers'

const ETIQUETA_TABLA: Record<TablaHistorial, string> = {
  conceptos: 'Concepto',
  asignaturas: 'Asignatura',
  tareas: 'Tarea'
}

/** Conecta los canales del historial: listar elementos, versiones y restaurar. */
export function registrarHandlersHistorial(historial: HistorialService): void {
  ipcMain.handle(CANALES.historialListar, () =>
    envolver<ItemHistorialDTO[]>(() =>
      historial.listarItems().map((i) => ({
        tabla: i.tabla,
        id: i.id,
        nombre: i.nombre,
        tipoEtiqueta: ETIQUETA_TABLA[i.tabla],
        versiones: i.versiones,
        ultimaModificacionMs: i.ultimaMs
      }))
    )
  )

  ipcMain.handle(CANALES.historialVersiones, (_evento, tabla: TablaHistorial, id: string) =>
    envolver<VersionHistorialDTO[]>(() =>
      historial.listarVersiones(tabla, id).map((v) => ({
        versionId: v.versionId,
        capturadoEnMs: v.capturadoEnMs,
        resumen: v.resumen
      }))
    )
  )

  ipcMain.handle(
    CANALES.historialRestaurar,
    (_evento, tabla: TablaHistorial, id: string, versionId: string) =>
      envolver<void>(() => {
        historial.restaurar(tabla, id, versionId)
      })
  )
}
