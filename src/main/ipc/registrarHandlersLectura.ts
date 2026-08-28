import { ipcMain, net } from 'electron'

import { CANALES } from '../../shared/canales'
import type { ElementoNoLeidoDTO, EstadoLecturaDTO } from '../../shared/dtos'
import { reindexarVault } from '../application/ReindexarVault'
import { leerConfigApp } from '../infrastructure/configApp'
import { CARPETA_COMPLETA, lecturasFallidas } from '../infrastructure/IncidenciasLectura'
import { comprobarUbicacionMaterial, type Servicios } from '../servicios'
import { envolver } from './registrarHandlers'
import { nombreVisibleDe } from './registrarHandlersAlmacenamiento'

/** Cuántos elementos se nombran en el aviso antes de resumir con "y N más". */
const MAX_ELEMENTOS = 8

/**
 * Foto del material que no se pudo leer, lista para la interfaz.
 *
 * Junta tres cosas que el aviso necesita para decir algo útil: qué falta, si
 * el material vive en una nube y si este equipo tiene conexión. Con eso la UI
 * distingue "no tienes internet" de "tu nube no ha iniciado sesión".
 */
export function estadoLectura(): EstadoLecturaDTO {
  const config = leerConfigApp()
  // Las incidencias de carpeta entera no son "un elemento que falta": se
  // cuentan aparte, porque lo que falta entonces no se puede ni enumerar.
  const fallos = lecturasFallidas.listar().filter((i) => i.id !== CARPETA_COMPLETA)
  const elementos: ElementoNoLeidoDTO[] = [...fallos]
    // Primero los que tienen nombre: son los que el docente reconoce.
    .sort((a, b) => (b.nombre ? 1 : 0) - (a.nombre ? 1 : 0))
    .slice(0, MAX_ELEMENTOS)
    .map((i) => ({ tipo: i.tipo, nombre: i.nombre ?? '' }))

  return {
    total: fallos.length,
    causa: lecturasFallidas.causaPrincipal(),
    carpetaCompleta: lecturasFallidas.hayCarpetaInaccesible(),
    enNube: config.modoAlmacenamiento === 'nube',
    nombreAlmacenamiento: nombreVisibleDe(config),
    hayConexion: net.isOnline(),
    elementos
  }
}

/**
 * Canales del aviso "hay material que no se pudo leer".
 *
 * `reintentar` es el botón del aviso: olvida lo anotado, vuelve a recorrer todo
 * el material (si la nube ya responde, esta pasada lo recupera) y devuelve el
 * estado resultante para que la interfaz se actualice sin recargar la ventana.
 */
export function registrarHandlersLectura(servicios: Servicios): void {
  const { vault, repositorio } = servicios

  ipcMain.handle(CANALES.lecturaEstado, () => envolver<EstadoLecturaDTO>(() => estadoLectura()))

  ipcMain.handle(CANALES.lecturaReintentar, () =>
    envolver<EstadoLecturaDTO>(() => {
      lecturasFallidas.limpiar()
      // `intentarTodo` desactiva el corte por nube caída: el docente pulsó
      // "Reintentar" a propósito y espera recuperar TODO su material, aunque
      // la pasada tarde más que un arranque normal.
      return lecturasFallidas.intentarTodo(() => {
        // Lo primero es si la carpeta ha vuelto: si el docente reconectó su
        // nube, esto la da por buena otra vez; si sigue sin estar, vuelve a
        // anotarlo y el aviso lo sigue diciendo.
        comprobarUbicacionMaterial(vault.raiz)
        // Conceptos y asignaturas se releen al reconstruir el índice; tareas y
        // lienzos no pasan por él, así que se tocan aquí para que el reintento
        // cubra todo el material.
        reindexarVault(vault, repositorio)
        vault.leerTodasTareas()
        vault.leerTodosLienzos()
        return estadoLectura()
      })
    })
  )
}
