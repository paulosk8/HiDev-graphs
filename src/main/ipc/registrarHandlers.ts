import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

import { CANALES } from '../../shared/canales'
import type {
  DatosAsignaturaDTO,
  DatosConceptoDTO,
  DatosTareaDTO,
  DuplicarTareaDTO
} from '../../shared/dtos'
import type { Resultado } from '../../shared/resultado'
import { ErrorDeDominio } from '../domain/errores'
import { crearConcepto } from '../application/CrearConcepto'
import { editarConcepto } from '../application/EditarConcepto'
import { eliminarConcepto } from '../application/EliminarConcepto'
import { obtenerFichaConcepto } from '../application/ObtenerFichaConcepto'
import { agregarMaterial } from '../application/AgregarMaterial'
import { eliminarMaterial } from '../application/EliminarMaterial'
import { crearAsignatura } from '../application/CrearAsignatura'
import { obtenerAsignatura } from '../application/ObtenerAsignatura'
import { eliminarAsignatura } from '../application/EliminarAsignatura'
import {
  agregarPeriodoAsignatura,
  quitarPeriodoAsignatura
} from '../application/PeriodosAsignatura'
import {
  desvincularTemaConcepto,
  vincularTemaConcepto
} from '../application/VincularTemaConcepto'
import {
  agregarAdjuntoTarea,
  crearTarea,
  crucesDeTarea,
  duplicarTarea,
  editarTarea,
  eliminarAdjuntoTarea,
  eliminarTarea,
  listarTareasDeAsignatura,
  listarTareasDeConcepto,
  obtenerTarea
} from '../application/Tareas'
import { obtenerGrafo } from '../application/ObtenerGrafo'
import { reindexarVault } from '../application/ReindexarVault'
import { respaldarVault } from '../application/RespaldarVault'
import type { RespaldoDTO } from '../../shared/dtos'
import type { Servicios } from '../servicios'

/** Nombre de archivo sugerido para el respaldo, con la fecha de hoy. */
function nombreRespaldo(): string {
  const hoy = new Date()
  const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(
    hoy.getDate()
  ).padStart(2, '0')}`
  return `PedagoGraph-respaldo-${iso}.zip`
}

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

  ipcMain.handle(CANALES.materialAgregar, (_evento, conceptoId: string, rutas: string[]) =>
    envolver(() => agregarMaterial(servicios, conceptoId, rutas))
  )

  ipcMain.handle(CANALES.materialEliminar, (_evento, conceptoId: string, recursoId: string) =>
    envolver(() => eliminarMaterial(servicios, conceptoId, recursoId))
  )

  ipcMain.handle(CANALES.materialAbrir, (_evento, conceptoId: string, archivo: string) =>
    envolver(async () => {
      const ruta = vault.rutaRecurso(conceptoId, archivo)
      if (ruta === null || !vault.existeRecurso(conceptoId, archivo)) {
        throw new ErrorDeDominio('No encontramos ese archivo.', 'Puede que se haya movido o eliminado.')
      }
      const error = await shell.openPath(ruta)
      if (error) throw new ErrorDeDominio('No se pudo abrir el archivo.', error)
    })
  )

  ipcMain.handle(CANALES.materialLeerTexto, (_evento, conceptoId: string, archivo: string) =>
    envolver(() => vault.leerTextoRecurso(conceptoId, archivo))
  )

  ipcMain.handle(CANALES.asignaturasListar, () => envolver(() => repositorio.listarAsignaturas()))

  ipcMain.handle(CANALES.asignaturaObtener, (_evento, id: string) =>
    envolver(() => obtenerAsignatura(servicios, id))
  )

  ipcMain.handle(CANALES.asignaturaCrear, (_evento, datos: DatosAsignaturaDTO) =>
    envolver(() => crearAsignatura(servicios, datos))
  )

  ipcMain.handle(CANALES.asignaturaEliminar, (_evento, id: string) =>
    envolver(() => eliminarAsignatura(servicios, id))
  )

  ipcMain.handle(CANALES.asignaturaAgregarPeriodo, (_e, id: string, periodo: string) =>
    envolver(() => agregarPeriodoAsignatura(servicios, id, periodo))
  )
  ipcMain.handle(CANALES.asignaturaQuitarPeriodo, (_e, id: string, periodo: string) =>
    envolver(() => quitarPeriodoAsignatura(servicios, id, periodo))
  )

  ipcMain.handle(
    CANALES.temaVincularConcepto,
    (_evento, asignaturaId: string, temaId: string, conceptoId: string) =>
      envolver(() => vincularTemaConcepto(servicios, asignaturaId, temaId, conceptoId))
  )

  ipcMain.handle(
    CANALES.temaDesvincularConcepto,
    (_evento, asignaturaId: string, temaId: string, conceptoId: string) =>
      envolver(() => desvincularTemaConcepto(servicios, asignaturaId, temaId, conceptoId))
  )

  // --- Tareas ---
  ipcMain.handle(CANALES.tareasDeAsignatura, (_e, asignaturaId: string) =>
    envolver(() => listarTareasDeAsignatura(servicios, asignaturaId))
  )
  ipcMain.handle(CANALES.tareasDeConcepto, (_e, conceptoId: string) =>
    envolver(() => listarTareasDeConcepto(servicios, conceptoId))
  )
  ipcMain.handle(CANALES.tareaObtener, (_e, id: string) =>
    envolver(() => obtenerTarea(servicios, id))
  )
  ipcMain.handle(CANALES.tareaCrear, (_e, datos: DatosTareaDTO) =>
    envolver(() => crearTarea(servicios, datos))
  )
  ipcMain.handle(CANALES.tareaEditar, (_e, id: string, datos: DatosTareaDTO) =>
    envolver(() => editarTarea(servicios, id, datos))
  )
  ipcMain.handle(CANALES.tareaEliminar, (_e, id: string) =>
    envolver(() => eliminarTarea(servicios, id))
  )
  ipcMain.handle(CANALES.tareaAdjuntoAgregar, (_e, tareaId: string, rutas: string[]) =>
    envolver(() => agregarAdjuntoTarea(servicios, tareaId, rutas))
  )
  ipcMain.handle(CANALES.tareaAdjuntoEliminar, (_e, tareaId: string, recursoId: string) =>
    envolver(() => eliminarAdjuntoTarea(servicios, tareaId, recursoId))
  )
  ipcMain.handle(CANALES.tareaCruces, (_e, tareaId: string) =>
    envolver(() => crucesDeTarea(servicios, tareaId))
  )
  ipcMain.handle(CANALES.tareaDuplicar, (_e, tareaId: string, destino: DuplicarTareaDTO) =>
    envolver(() => duplicarTarea(servicios, tareaId, destino))
  )
  ipcMain.handle(CANALES.tareaAdjuntoAbrir, (_e, tareaId: string, archivo: string) =>
    envolver(async () => {
      const ruta = vault.rutaAdjuntoTarea(tareaId, archivo)
      if (ruta === null) {
        throw new ErrorDeDominio('No encontramos ese adjunto.', 'Puede que se haya movido o eliminado.')
      }
      const error = await shell.openPath(ruta)
      if (error) throw new ErrorDeDominio('No se pudo abrir el adjunto.', error)
    })
  )

  ipcMain.handle(CANALES.grafoObtener, () => envolver(() => obtenerGrafo(servicios)))

  ipcMain.handle(CANALES.mcpInfo, () =>
    envolver(() => {
      const rutaServidor = join(app.getAppPath(), 'out', 'mcp', 'pedagograph-mcp.mjs')
      return {
        rutaServidor,
        rutaVault: vault.raiz,
        ejecutable: process.execPath,
        compilado: existsSync(rutaServidor)
      }
    })
  )

  ipcMain.handle(CANALES.reindexar, () => envolver(() => reindexarVault(vault, repositorio)))

  ipcMain.handle(CANALES.respaldar, (evento) =>
    envolver<RespaldoDTO>(async () => {
      const ventana = BrowserWindow.fromWebContents(evento.sender)
      const destino = join(app.getPath('documents'), nombreRespaldo())
      const seleccion = ventana
        ? await dialog.showSaveDialog(ventana, {
            title: 'Guardar copia de seguridad',
            defaultPath: destino,
            filters: [{ name: 'Archivo comprimido', extensions: ['zip'] }]
          })
        : await dialog.showSaveDialog({ defaultPath: destino })

      if (seleccion.canceled || !seleccion.filePath) return { cancelado: true }

      await respaldarVault(servicios, seleccion.filePath)
      return { cancelado: false, ruta: seleccion.filePath }
    })
  )
}
