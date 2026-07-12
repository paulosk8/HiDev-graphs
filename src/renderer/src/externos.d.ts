declare module 'cytoscape-fcose' {
  import type cytoscape from 'cytoscape'
  const fcose: cytoscape.Ext
  export default fcose
}

interface Window {
  /** Handle de depuración de la instancia de Cytoscape del mapa de conceptos. */
  __cy?: import('cytoscape').Core
  /** Handle de depuración de la terminal (xterm). */
  __term?: import('@xterm/xterm').Terminal
}
