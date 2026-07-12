import { ipcMain } from 'electron'

import { CANALES } from '../../shared/canales'
import type { DatosConceptoDTO } from '../../shared/dtos'
import type { Resultado } from '../../shared/resultado'
import { ErrorDeDominio } from '../domain/errores'
import { crearConcepto } from '../application/CrearConcepto'
import { editarConcepto } from '../application/EditarConcepto'
import { eliminarConcepto } from '../application/EliminarConcepto'
import { obtenerFichaConcepto } from '../application/ObtenerFichaConcepto'
import { reindexarVault } from '../application/ReindexarVault'
import type { Servicios } from '../servicios'

/**
 * Ejecuta un caso de uso y lo envuelve en un `Resultado<T>`.
 *
 * - `ErrorDeDominio` -> mensaje y sugerencia humanos, tal cual.
 * - Cualquier otro error -> mensaje genérico amable (y se registra en consola).
 * Nada cruza el puente como excepción: el renderer siempre recibe un Resultado.
 */
async function envolver<T>(fn: () => T | Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, valor: await fn() }
  } catch (error) {
    if (error instanceof ErrorDeDominio) {
      return { ok: false, error: { mensaje: error.message, sugerencia: error.sugerencia } }
    }
    console.error('[IPC] Error inesperado:', error)
    return {
      ok: false,
      error: {
        mensaje: 'Ocurrió un problema inesperado.',
        sugerencia: 'Vuelve a intentarlo. Si el problema continúa, reinicia la aplicación.'
      }
    }
  }
}

/**
 * Registra todos los handlers IPC, conectando cada canal con el caso de uso o
 * consulta correspondiente. Se llama una vez, tras inicializar los servicios.
 */
export function registrarHandlersIpc(servicios: Servicios): void {
  const { vault, repositorio } = servicios

  ipcMain.handle(CANALES.conceptosListar, () => envolver(() => repositorio.listarConceptos()))

  ipcMain.handle(CANALES.conceptosBuscar, (_evento, texto: string) =>
    envolver(() => repositorio.buscarConceptos(texto))
  )

  ipcMain.handle(CANALES.conceptoUsos, (_evento, conceptoId: string) =>
    envolver(() => repositorio.usosDeConcepto(conceptoId))
  )

  ipcMain.handle(CANALES.conceptoObtenerFicha, (_evento, conceptoId: string) =>
    envolver(() => obtenerFichaConcepto(servicios, conceptoId))
  )

  ipcMain.handle(CANALES.conceptoCrear, (_evento, datos: DatosConceptoDTO) =>
    envolver(() => crearConcepto(servicios, datos))
  )

  ipcMain.handle(CANALES.conceptoEditar, (_evento, id: string, datos: DatosConceptoDTO) =>
    envolver(() => editarConcepto(servicios, id, datos))
  )

  ipcMain.handle(CANALES.conceptoEliminar, (_evento, id: string) =>
    envolver(() => eliminarConcepto(servicios, id))
  )

  ipcMain.handle(CANALES.asignaturasListar, () => envolver(() => repositorio.listarAsignaturas()))

  ipcMain.handle(CANALES.reindexar, () => envolver(() => reindexarVault(vault, repositorio)))
}
