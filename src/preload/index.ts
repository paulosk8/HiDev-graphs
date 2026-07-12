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
  abrirMaterial: (conceptoId, archivo) => ipcRenderer.invoke(CANALES.materialAbrir, conceptoId, archivo),
  leerTextoMaterial: (conceptoId, archivo) =>
    ipcRenderer.invoke(CANALES.materialLeerTexto, conceptoId, archivo),
  listarAsignaturas: () => ipcRenderer.invoke(CANALES.asignaturasListar),
  obtenerAsignatura: (id) => ipcRenderer.invoke(CANALES.asignaturaObtener, id),
  crearAsignatura: (datos) => ipcRenderer.invoke(CANALES.asignaturaCrear, datos),
  eliminarAsignatura: (id) => ipcRenderer.invoke(CANALES.asignaturaEliminar, id),
  vincularTemaConcepto: (asignaturaId, temaId, conceptoId) =>
    ipcRenderer.invoke(CANALES.temaVincularConcepto, asignaturaId, temaId, conceptoId),
  desvincularTemaConcepto: (asignaturaId, temaId, conceptoId) =>
    ipcRenderer.invoke(CANALES.temaDesvincularConcepto, asignaturaId, temaId, conceptoId),
  listarTareasDeAsignatura: (asignaturaId) =>
    ipcRenderer.invoke(CANALES.tareasDeAsignatura, asignaturaId),
  listarTareasDeConcepto: (conceptoId) => ipcRenderer.invoke(CANALES.tareasDeConcepto, conceptoId),
  obtenerTarea: (id) => ipcRenderer.invoke(CANALES.tareaObtener, id),
  crearTarea: (datos) => ipcRenderer.invoke(CANALES.tareaCrear, datos),
  editarTarea: (id, datos) => ipcRenderer.invoke(CANALES.tareaEditar, id, datos),
  eliminarTarea: (id) => ipcRenderer.invoke(CANALES.tareaEliminar, id),
  agregarAdjuntoTarea: (tareaId, rutas) =>
    ipcRenderer.invoke(CANALES.tareaAdjuntoAgregar, tareaId, rutas),
  eliminarAdjuntoTarea: (tareaId, recursoId) =>
    ipcRenderer.invoke(CANALES.tareaAdjuntoEliminar, tareaId, recursoId),
  abrirAdjuntoTarea: (tareaId, archivo) =>
    ipcRenderer.invoke(CANALES.tareaAdjuntoAbrir, tareaId, archivo),
  crucesDeTarea: (tareaId) => ipcRenderer.invoke(CANALES.tareaCruces, tareaId),
  duplicarTarea: (tareaId, destino) => ipcRenderer.invoke(CANALES.tareaDuplicar, tareaId, destino),
  reindexar: () => ipcRenderer.invoke(CANALES.reindexar),
  respaldar: () => ipcRenderer.invoke(CANALES.respaldar),
  onVaultCambiado: (callback) => {
    const oyente = (): void => callback()
    ipcRenderer.on(CANALES.vaultCambiado, oyente)
    return () => ipcRenderer.removeListener(CANALES.vaultCambiado, oyente)
  }
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
