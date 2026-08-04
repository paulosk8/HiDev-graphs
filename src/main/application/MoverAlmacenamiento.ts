import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync
} from 'node:fs'
import { join, resolve } from 'node:path'

import { ErrorDeDominio, exigir } from '../domain/errores'
import {
  guardarConfigApp,
  leerConfigApp,
  resolverRutaVault,
  rutaVaultLocalPorDefecto,
  type ModoAlmacenamiento
} from '../infrastructure/configApp'

/** Carpetas del vault que contienen material y datos del usuario (nunca el índice). */
const CARPETAS_VAULT = ['conceptos', 'asignaturas', 'tareas'] as const

export type DestinoAlmacenamiento =
  | { modo: 'local' }
  | {
      modo: 'nube'
      /** Carpeta contenedora (ubicación elegida, p. ej. tu Google Drive / OneDrive). */
      rutaContenedor: string
      /** Nombre de la carpeta a crear dentro (el "vault"). */
      nombreCarpeta: string
    }

export interface ResultadoMover {
  modo: ModoAlmacenamiento
  /** Ruta del vault resultante. */
  rutaVault: string
  /** true si el destino YA tenía material (otro equipo lo había sincronizado). */
  adoptado: boolean
  /** true si no había nada que mover (ya estaba en ese sitio). */
  sinCambios: boolean
}

/**
 * Copia recursivamente `origen` en `destino` SIN sobrescribir archivos que ya
 * existan en el destino (se conserva la versión del destino). Nunca borra nada.
 * Es la operación segura para adoptar una carpeta de nube que ya trae material.
 */
function copiarSinSobrescribir(origen: string, destino: string): void {
  if (!existsSync(origen)) return
  mkdirSync(destino, { recursive: true })
  for (const entrada of readdirSync(origen)) {
    const rutaOrigen = join(origen, entrada)
    const rutaDestino = join(destino, entrada)
    if (statSync(rutaOrigen).isDirectory()) {
      copiarSinSobrescribir(rutaOrigen, rutaDestino)
    } else if (!existsSync(rutaDestino)) {
      copyFileSync(rutaOrigen, rutaDestino)
    }
  }
}

/** ¿La carpeta del vault en `raiz` ya contiene material (conceptos/asignaturas/tareas)? */
function tieneMaterial(raiz: string): boolean {
  return CARPETAS_VAULT.some((c) => {
    const dir = join(raiz, c)
    try {
      return existsSync(dir) && readdirSync(dir).length > 0
    } catch {
      return false
    }
  })
}

/**
 * Mueve el almacenamiento del material entre "este equipo" (Documentos) y una
 * carpeta de nube (Google Drive / OneDrive) — Opción A: la nube la sincroniza
 * su propio cliente de escritorio.
 *
 * Seguridad ante todo: COPIA (nunca borra el origen) y no sobrescribe lo que ya
 * exista en el destino. Así, cambiar de sitio jamás pierde material y un segundo
 * equipo adopta la carpeta ya sincronizada sin machacar nada. Persiste la
 * preferencia; el llamador reinicia la app para aplicarla.
 */
/** Deja un nombre de carpeta seguro: sin separadores de ruta ni "..". */
function nombreCarpetaSeguro(nombre: string): string {
  const limpio = nombre.replace(/[\\/]/g, '').trim()
  exigir(
    limpio.length > 0 && limpio !== '.' && limpio !== '..',
    'El nombre de la carpeta no es válido.',
    'Escribe un nombre, por ejemplo “PedagoGraph” o “Mi material de clase”.'
  )
  return limpio
}

export function moverAlmacenamiento(destino: DestinoAlmacenamiento): ResultadoMover {
  const vaultActual = resolverRutaVault(leerConfigApp())

  // Calcula la carpeta destino del vault y la configuración a persistir.
  // Elegir un destino cuenta como "configurado" (completa la bienvenida).
  let vaultDestino: string
  let config: { configurado: true; modoAlmacenamiento: ModoAlmacenamiento; rutaVaultNube?: string }
  if (destino.modo === 'nube') {
    const contenedor = destino.rutaContenedor
    exigir(
      typeof contenedor === 'string' && contenedor.length > 0,
      'No se indicó dónde guardar el material.',
      'Elige una ubicación (tu Google Drive u OneDrive) o busca una carpeta.'
    )
    exigir(
      existsSync(contenedor) && statSync(contenedor).isDirectory(),
      'No encontramos esa carpeta en este equipo.',
      'Asegúrate de que la carpeta existe y de que tu nube esté sincronizando.'
    )
    vaultDestino = join(contenedor, nombreCarpetaSeguro(destino.nombreCarpeta))
    config = { configurado: true, modoAlmacenamiento: 'nube', rutaVaultNube: vaultDestino }
  } else {
    vaultDestino = rutaVaultLocalPorDefecto()
    config = { configurado: true, modoAlmacenamiento: 'local' }
  }

  // Ya está en ese sitio: solo asegura la preferencia guardada.
  if (resolve(vaultDestino) === resolve(vaultActual)) {
    guardarConfigApp(config)
    return { modo: destino.modo, rutaVault: vaultDestino, adoptado: false, sinCambios: true }
  }

  const adoptado = tieneMaterial(vaultDestino)

  // Copia el material del vault actual al destino (sin sobrescribir ni borrar).
  try {
    mkdirSync(vaultDestino, { recursive: true })
    for (const carpeta of CARPETAS_VAULT) {
      copiarSinSobrescribir(join(vaultActual, carpeta), join(vaultDestino, carpeta))
    }
  } catch (error) {
    throw new ErrorDeDominio(
      'No pudimos guardar tu material en la carpeta elegida.',
      'Comprueba que tienes permiso de escritura y espacio disponible, e inténtalo de nuevo.'
    )
  }

  guardarConfigApp(config)
  return { modo: destino.modo, rutaVault: vaultDestino, adoptado, sinCambios: false }
}
