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
  type ConfigApp,
  type ModoAlmacenamiento
} from '../infrastructure/configApp'

/** Carpetas del vault que contienen material y datos del usuario (nunca el índice). */
const CARPETAS_VAULT = ['conceptos', 'asignaturas', 'tareas', 'lienzos'] as const

export type DestinoAlmacenamiento =
  | { modo: 'local' }
  | {
      modo: 'nube'
      /** Carpeta contenedora (ubicación elegida, p. ej. tu Google Drive / OneDrive). */
      rutaContenedor: string
      /** Nombre de la carpeta a crear dentro (el "vault"). */
      nombreCarpeta: string
      /**
       * Qué se quiere hacer con esa carpeta:
       *  - `mover` (por defecto) → llevar allí el material de ahora. Es lo que
       *    se hace al estrenar una ubicación o al pasar de una nube a otra.
       *  - `abrir`  → esa carpeta YA tiene material (la sincronizó otro equipo,
       *    o es la de siempre y solo se había perdido el rastro) y se quiere
       *    trabajar con ella tal cual, sin copiarle nada encima.
       *
       * La diferencia importa: "abrir" con la semántica de "mover" mezclaría
       * dos materiales distintos en una sola carpeta, y eso no se deshace.
       */
      accion?: 'mover' | 'abrir'
    }

export interface ResultadoMover {
  modo: ModoAlmacenamiento
  /** Ruta del vault resultante. */
  rutaVault: string
  /** true si el destino YA tenía material (otro equipo lo había sincronizado). */
  adoptado: boolean
  /** true si no había nada que mover (ya estaba en ese sitio). */
  sinCambios: boolean
  /** true si se abrió material existente sin copiarle nada encima. */
  abierto: boolean
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
  const configActual = leerConfigApp()
  const vaultActual = resolverRutaVault(configActual)

  // Calcula la carpeta destino del vault y la configuración a persistir.
  // Elegir un destino cuenta como "configurado" (completa la bienvenida).
  // Se parte de la config actual para NO perder las demás preferencias del
  // docente (p. ej. qué pasa al eliminar) al cambiar de sitio el material.
  let vaultDestino: string
  let config: ConfigApp
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
    config = {
      ...configActual,
      configurado: true,
      modoAlmacenamiento: 'nube',
      rutaVaultNube: vaultDestino
    }
  } else {
    vaultDestino = rutaVaultLocalPorDefecto()
    config = { ...configActual, configurado: true, modoAlmacenamiento: 'local' }
  }

  // Ya está en ese sitio: solo asegura la preferencia guardada.
  if (resolve(vaultDestino) === resolve(vaultActual)) {
    guardarConfigApp(config)
    return {
      modo: destino.modo,
      rutaVault: vaultDestino,
      adoptado: false,
      sinCambios: true,
      abierto: false
    }
  }

  const adoptado = tieneMaterial(vaultDestino)

  // Abrir material existente: NO se copia nada. El material de ahora se queda
  // donde está, intacto; simplemente se deja de mirar esa carpeta y se mira
  // esta. Es la operación que pide "tengo mi material ahí, ábrelo".
  if (destino.modo === 'nube' && destino.accion === 'abrir') {
    exigir(
      adoptado,
      'Esa carpeta no tiene material de PedagoGraph.',
      'Elige la carpeta donde ya guardabas tu material, o usa “Mover aquí” para llevar el actual.'
    )
    guardarConfigApp(config)
    return {
      modo: destino.modo,
      rutaVault: vaultDestino,
      adoptado: true,
      sinCambios: false,
      abierto: true
    }
  }

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
  return { modo: destino.modo, rutaVault: vaultDestino, adoptado, sinCambios: false, abierto: false }
}
