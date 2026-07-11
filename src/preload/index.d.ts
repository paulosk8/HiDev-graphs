// Tipos de la API expuesta al renderer vía contextBridge.
// Se ampliará con el contrato IPC en el bloque correspondiente.
export interface PedagoGraphApi {}

declare global {
  interface Window {
    api: PedagoGraphApi
  }
}
