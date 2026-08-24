import { exigir } from './errores'

/**
 * Término del glosario de un concepto: una palabra y su definición corta.
 *
 * NO es un concepto en miniatura, y la diferencia es deliberada. Un concepto se
 * reutiliza entre asignaturas, tiene material y sale en el mapa; "prop" o
 * "estado" no quieren nada de eso —quieren una frase que se pueda consultar—.
 * Meterlos como conceptos llenaría el grafo de micro-nodos y ahogaría la
 * pregunta que el mapa responde. Cuando un término crece, se promueve.
 *
 * Tampoco es una nota: la nota es prosa libre (con formatos, código, pegado
 * rico) y por eso no se puede consultar. Aquí la forma es fija —término y
 * definición—, que es lo que permite buscarlo, ordenarlo alfabéticamente y, más
 * adelante, exportarlo como glosario para el estudiante.
 */
export interface Termino {
  readonly id: string
  /** La palabra o expresión, tal como la escribió el docente. */
  readonly termino: string
  /** Su definición, en texto plano y corta a propósito. */
  readonly definicion: string
}

/** Recorta y colapsa espacios; conserva mayúsculas y tildes tal cual se escriben. */
export function normalizarTermino(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ')
}

/**
 * Clave de comparación de un término: sin mayúsculas ni tildes. Sirve para
 * avisar de un duplicado ("Prop" y "prop" son el mismo) y para buscarlo sin que
 * el docente tenga que recordar cómo lo escribió.
 */
export function claveTermino(texto: string): string {
  return normalizarTermino(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function crearTermino(datos: {
  id: string
  termino: string
  definicion: string
}): Termino {
  const termino = normalizarTermino(datos.termino)
  const definicion = datos.definicion.trim()
  exigir(datos.id.trim().length > 0, 'El término no tiene identificador.')
  exigir(termino.length > 0, 'Escribe el término.', 'Por ejemplo: «Prop».')
  exigir(
    definicion.length > 0,
    'Escribe la definición del término.',
    'Con una o dos frases basta.'
  )
  return { id: datos.id.trim(), termino, definicion }
}
