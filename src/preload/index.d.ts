import type { PedagoGraphApi } from '../shared/api'

// Tipos de la API expuesta al renderer vía contextBridge.
declare global {
  interface Window {
    api: PedagoGraphApi
  }
}

export {}
