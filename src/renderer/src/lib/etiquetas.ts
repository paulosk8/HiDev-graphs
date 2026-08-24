/**
 * Reglas de etiquetas compartidas por el campo del formulario y la edición en
 * línea de la ficha. Están aquí para que no se separen: si una acepta `#parcial`
 * y la otra no, el docente ve dos comportamientos para la misma idea.
 *
 * El saneado de verdad (normalizar y quitar duplicados) lo hace el dominio al
 * guardar; esto es solo lo que la interfaz necesita para no ofrecer basura.
 */

/** Quita la almohadilla que se teclea por costumbre (`#parcial`) y recorta. */
export function limpiarEtiqueta(bruta: string): string {
  return bruta.replace(/^#+/, '').trim()
}

/** Clave de comparación: sin mayúsculas ni tildes («Parcial» = «parcial»). */
export function claveEtiqueta(texto: string): string {
  return limpiarEtiqueta(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}
