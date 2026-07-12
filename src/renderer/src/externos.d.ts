declare module 'cytoscape-fcose' {
  import type cytoscape from 'cytoscape'
  const fcose: cytoscape.Ext
  export default fcose
}

declare global {
  interface Window {
    /** Handle de depuración de la instancia de Cytoscape del mapa de conceptos. */
    __cy?: import('cytoscape').Core
  }
}

export {}
