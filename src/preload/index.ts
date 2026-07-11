import { contextBridge } from 'electron'

// La API tipada del renderer se ampliará en el bloque del contrato IPC.
// Por ahora solo establecemos el puente seguro (contextIsolation).
const api = {}

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
