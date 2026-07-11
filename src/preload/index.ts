import { contextBridge, ipcRenderer } from 'electron'

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
  listarAsignaturas: () => ipcRenderer.invoke(CANALES.asignaturasListar),
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
