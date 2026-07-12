import { contextBridge, ipcRenderer, webUtils } from 'electron'

import { CANALES } from '../shared/canales'
import type { PedagoGraphApi } from '../shared/api'

/**
 * Implementación de la API expuesta al renderer. Cada método reenvía la llamada
 * al proceso main por su canal IPC. Sin lógica de negocio: solo transporte.
 */
const api: PedagoGraphApi = {
  listarConceptos: () => ipcRenderer.invoke(CANALES.conceptosListar),
  buscarConceptos: (texto) => ipcRenderer.invoke(CANALES.conceptosBuscar, texto),
  usosDeConcepto: (conceptoId) => ipcRenderer.invoke(CANALES.conceptoUsos, conceptoId),
  obtenerFichaConcepto: (conceptoId) => ipcRenderer.invoke(CANALES.conceptoObtenerFicha, conceptoId),
  crearConcepto: (datos) => ipcRenderer.invoke(CANALES.conceptoCrear, datos),
  editarConcepto: (id, datos) => ipcRenderer.invoke(CANALES.conceptoEditar, id, datos),
  eliminarConcepto: (id) => ipcRenderer.invoke(CANALES.conceptoEliminar, id),
  rutaDeArchivo: (archivo) => webUtils.getPathForFile(archivo),
  agregarMaterial: (conceptoId, rutas) =>
    ipcRenderer.invoke(CANALES.materialAgregar, conceptoId, rutas),
  eliminarMaterial: (conceptoId, recursoId) =>
    ipcRenderer.invoke(CANALES.materialEliminar, conceptoId, recursoId),
  listarAsignaturas: () => ipcRenderer.invoke(CANALES.asignaturasListar),
  obtenerAsignatura: (id) => ipcRenderer.invoke(CANALES.asignaturaObtener, id),
  crearAsignatura: (datos) => ipcRenderer.invoke(CANALES.asignaturaCrear, datos),
  eliminarAsignatura: (id) => ipcRenderer.invoke(CANALES.asignaturaEliminar, id),
  reindexar: () => ipcRenderer.invoke(CANALES.reindexar)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (fallback si contextIsolation estuviera desactivado)
  window.api = api
}
