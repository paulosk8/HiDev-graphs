import { exigir } from './errores'
import { nombreCarpetaSeguro } from './Recurso'

/**
 * Enlace web: material del concepto que vive fuera del vault.
 *
 * Para el docente un vídeo de YouTube o un simulador online son *material*
 * igual que un PDF, así que se listan juntos. Por dentro son cosas distintas:
 * el `Recurso` es un archivo copiado a la carpeta del concepto, y el enlace
 * solo una dirección guardada en `concepto.yaml`.
 *
 * De ahí la única diferencia de modelo: la `carpeta` de un `Recurso` se deriva
 * de su ruta en disco, mientras que aquí es un campo propio —un enlace no
 * puede vivir dentro de una carpeta real, pero sí agruparse con el material
 * que la ocupa.
 */
export interface EnlaceMaterial {
  readonly id: string
  /** Nombre visible. Si el docente no escribe ninguno, se usa la dirección. */
  readonly titulo: string
  readonly url: string
  /** Carpeta que lo agrupa, o '' si está suelto. */
  readonly carpeta: string
}

export interface DatosEnlaceMaterial {
  id: string
  titulo?: string
  url: string
  carpeta?: string
}

/**
 * Completa la dirección que escribe el docente. Nadie teclea "https://" al
 * copiar una dirección a mano, y sin esquema el navegador la trataría como
 * una ruta relativa.
 */
export function normalizarUrl(url: string): string {
  const limpia = url.trim()
  if (!limpia) return ''
  return /^https?:\/\//i.test(limpia) ? limpia : `https://${limpia}`
}

export function crearEnlaceMaterial(datos: DatosEnlaceMaterial): EnlaceMaterial {
  const url = normalizarUrl(datos.url)
  exigir(datos.id.trim().length > 0, 'El enlace no tiene identificador.')
  exigir(
    url.length > 0,
    'El enlace necesita una dirección.',
    'Pega la dirección de la página, por ejemplo www.khanacademy.org.'
  )
  exigir(
    // Una dirección sin punto ("https://apuntes") no lleva a ninguna parte.
    /^https?:\/\/[^\s/]+\.[^\s/]+/i.test(url),
    'Esa dirección no parece una página web.',
    'Revisa que esté completa, por ejemplo https://es.wikipedia.org/wiki/Algoritmo.'
  )

  const titulo = (datos.titulo ?? '').trim()
  return {
    id: datos.id.trim(),
    // Sin título, la dirección es mejor etiqueta que un hueco en blanco.
    titulo: titulo || url,
    url,
    carpeta: nombreCarpetaSeguro(datos.carpeta ?? '')
  }
}
