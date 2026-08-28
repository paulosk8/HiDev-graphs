import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { dirname } from 'node:path'

import { CANALES } from '../../shared/canales'
import type {
  AlmacenamientoDTO,
  CarpetaNubeDTO,
  MaterialEnCarpetaDTO,
  MaterialEncontradoDTO,
  ResultadoAlmacenamientoDTO
} from '../../shared/dtos'
import { moverAlmacenamiento, type ResultadoMover } from '../application/MoverAlmacenamiento'
import {
  guardarConfigApp,
  leerConfigApp,
  resolverRutaVault,
  type ConfigApp
} from '../infrastructure/configApp'
import {
  buscarMaterialExistente,
  detectarCarpetasNube,
  inspeccionarCarpetaMaterial
} from '../infrastructure/DeteccionNube'
import { envolver } from './registrarHandlers'

/**
 * Nombre amigable de dónde se guarda el material, para la UI. Se deriva de la
 * ruta (no de re-detectar la nube), así siempre es estable aunque el cliente de
 * nube no esté respondiendo en ese instante.
 */
export function nombreVisibleDe(config: ConfigApp): string {
  if (config.modoAlmacenamiento !== 'nube') return 'Este equipo'
  const ruta = (config.rutaVaultNube ?? config.rutaContenedorNube ?? '').toLowerCase()
  if (!ruta) return 'tu nube'
  if (ruta.includes('onedrive')) return 'OneDrive'
  if (ruta.includes('googledrive') || ruta.includes('google drive')) return 'Google Drive'
  return 'tu nube'
}

function aResultadoDTO(r: ResultadoMover, nombreVisible: string): ResultadoAlmacenamientoDTO {
  return {
    modo: r.modo,
    nombreVisible,
    adoptado: r.adoptado,
    sinCambios: r.sinCambios,
    abierto: r.abierto
  }
}

/** Comparación de rutas tolerante a mayúsculas (macOS y Windows no distinguen). */
function mismaRuta(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Canales para elegir dónde vive el material: en este equipo o dentro de una
 * carpeta de nube (Google Drive / OneDrive) que su cliente ya sincroniza.
 * Cambiar de sitio copia el material, guarda la preferencia y aplica el cambio
 * en caliente (`aplicar`) recargando la interfaz, sin reiniciar el proceso.
 */
export function registrarHandlersAlmacenamiento(aplicar: () => Promise<void>): void {
  ipcMain.handle(CANALES.almacenamientoEstado, () =>
    envolver<AlmacenamientoDTO>(() => {
      const config = leerConfigApp()
      return {
        configurado: config.configurado === true,
        modo: config.modoAlmacenamiento,
        nombreVisible: nombreVisibleDe(config),
        ruta: resolverRutaVault(config)
      }
    })
  )

  ipcMain.handle(CANALES.almacenamientoCarpetasNube, () =>
    envolver<CarpetaNubeDTO[]>(() =>
      detectarCarpetasNube().map((c) => ({
        proveedor: c.proveedor,
        etiqueta: c.etiqueta,
        ruta: c.ruta,
        rutaVisible: c.rutaVisible,
        oculta: (leerConfigApp().ubicacionesOcultas ?? []).some((r) => mismaRuta(r, c.ruta))
      }))
    )
  )

  ipcMain.handle(
    CANALES.almacenamientoInspeccionar,
    (_evento, rutaContenedor: string, nombreCarpeta: string) =>
      envolver<MaterialEnCarpetaDTO>(() =>
        inspeccionarCarpetaMaterial(rutaContenedor, nombreCarpeta)
      )
  )

  /**
   * Quita una ubicación de la lista, o la devuelve. Solo afecta a lo que se
   * ofrece al elegir dónde guardar: en el disco no se toca nada.
   */
  ipcMain.handle(
    CANALES.almacenamientoOcultarUbicacion,
    (_evento, ruta: string, oculta: boolean) =>
      envolver<void>(() => {
        const config = leerConfigApp()
        const actuales = (config.ubicacionesOcultas ?? []).filter((r) => !mismaRuta(r, ruta))
        guardarConfigApp({
          ...config,
          ubicacionesOcultas: oculta ? [...actuales, ruta] : actuales
        })
      })
  )

  /**
   * Busca material ya existente en las nubes del equipo y en Documentos. Es lo
   * que evita que el docente tenga que recordar en qué subcarpeta lo dejó y
   * llegar hasta ella con el explorador de archivos.
   */
  ipcMain.handle(CANALES.almacenamientoBuscarMaterial, () =>
    envolver<MaterialEncontradoDTO[]>(() =>
      buscarMaterialExistente([
        ...detectarCarpetasNube().map((c) => c.ruta),
        // El sitio por defecto en este equipo y la carpeta que contiene el
        // vault de ahora: material que estuvo ahí sigue estando.
        app.getPath('documents'),
        dirname(resolverRutaVault())
      ])
    )
  )

  ipcMain.handle(CANALES.almacenamientoElegirCarpeta, () =>
    envolver<string | null>(async () => {
      const ventana = BrowserWindow.getFocusedWindow() ?? undefined
      const opciones: OpenDialogOptions = {
        title: 'Elige la carpeta donde guardar tu material',
        message: 'Elige (o crea) una carpeta, por ejemplo dentro de tu Google Drive u OneDrive.',
        buttonLabel: 'Usar esta carpeta',
        properties: ['openDirectory', 'createDirectory']
      }
      const r = ventana
        ? await dialog.showOpenDialog(ventana, opciones)
        : await dialog.showOpenDialog(opciones)
      return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0]
    })
  )

  ipcMain.handle(
    CANALES.almacenamientoUsarNube,
    (_evento, rutaContenedor: string, nombreCarpeta: string, accion?: 'mover' | 'abrir') =>
      envolver<ResultadoAlmacenamientoDTO>(() => {
        const r = moverAlmacenamiento({ modo: 'nube', rutaContenedor, nombreCarpeta, accion })
        const dto = aResultadoDTO(r, nombreVisibleDe(leerConfigApp()))
        // Aplica en caliente tras responder al renderer (recarga la ventana).
        if (!r.sinCambios) setTimeout(() => void aplicar(), 150)
        return dto
      })
  )

  ipcMain.handle(CANALES.almacenamientoUsarLocal, () =>
    envolver<ResultadoAlmacenamientoDTO>(() => {
      const r = moverAlmacenamiento({ modo: 'local' })
      const dto = aResultadoDTO(r, 'Este equipo')
      if (!r.sinCambios) setTimeout(() => void aplicar(), 150)
      return dto
    })
  )
}
