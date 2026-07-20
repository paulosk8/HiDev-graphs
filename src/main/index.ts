import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { inicializarServicios, type Servicios } from './servicios'
import { registrarHandlersIpc } from './ipc/registrarHandlers'
import { registrarHandlersAlmacenamiento } from './ipc/registrarHandlersAlmacenamiento'
import { registrarHandlersHistorial } from './ipc/registrarHandlersHistorial'
import { registrarHandlersTerminal, cerrarTerminal } from './ipc/terminal'
import { IndexSyncService } from './infrastructure/IndexSyncService'
import { HistorialService } from './infrastructure/HistorialService'
import { reindexarVault } from './application/ReindexarVault'
import {
  resolverRutaVault,
  rutaHistorialPorEquipo,
  rutaIndicePorEquipo
} from './infrastructure/configApp'
import {
  habilitarProtocoloRecurso,
  registrarEsquemaRecursoPrivilegiado
} from './protocoloRecurso'
import { CANALES } from '../shared/canales'

// Nombre visible de la app (menú de macOS, avisos del sistema).
app.setName('PedagoGraph')

// El esquema recurso:// debe registrarse antes de que la app esté lista.
registrarEsquemaRecursoPrivilegiado()

let servicios: Servicios | null = null
let sincronizador: IndexSyncService | null = null
let historial: HistorialService | null = null
let ventanaPrincipal: BrowserWindow | null = null

function createWindow(): void {
  const ventana = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'PedagoGraph',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  ventanaPrincipal = ventana

  ventana.on('ready-to-show', () => {
    ventana.show()
  })

  // Los enlaces externos se abren en el navegador del sistema, no dentro de la app.
  ventana.webContents.setWindowOpenHandler((detalles) => {
    shell.openExternal(detalles.url)
    return { action: 'deny' }
  })

  // En desarrollo carga el servidor de Vite; en producción, el HTML compilado.
  if (process.env['ELECTRON_RENDERER_URL']) {
    ventana.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    ventana.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * Arranca el observador del vault (archivos -> índice). Cuando el cliente de
 * nube (Google Drive / OneDrive) baja cambios desde otro equipo, el watcher los
 * detecta, reindexa y refresca la interfaz. Se recrea al cambiar de carpeta.
 */
function iniciarObservadorVault(): void {
  if (!servicios) return
  sincronizador = new IndexSyncService(servicios.vault, servicios.repositorio, () => {
    // Tras cada cambio: guarda una versión en el historial y avisa al renderer.
    historial?.capturar()
    if (ventanaPrincipal && !ventanaPrincipal.isDestroyed()) {
      ventanaPrincipal.webContents.send(CANALES.vaultCambiado)
    }
  })
  sincronizador.iniciar()
}

/**
 * Aplica un cambio de almacenamiento (mover el material a/desde una carpeta de
 * nube) SIN reiniciar el proceso: re-apunta el núcleo a la nueva carpeta en
 * caliente y recarga la ventana. Reiniciar la app entera es frágil bajo el
 * servidor de desarrollo; esto funciona igual en dev y en producción.
 */
async function aplicarCambioAlmacenamiento(): Promise<void> {
  if (!servicios) return
  await sincronizador?.detener()
  servicios.vault.reapuntar(resolverRutaVault(), rutaIndicePorEquipo())
  servicios.vault.asegurarVault()
  servicios.repositorio.reabrir(servicios.vault.rutaBaseDatos)
  reindexarVault(servicios.vault, servicios.repositorio)
  historial?.capturar()
  iniciarObservadorVault()
  if (ventanaPrincipal && !ventanaPrincipal.isDestroyed()) {
    ventanaPrincipal.webContents.reload()
  }
}

app.whenReady().then(() => {
  // Inicializa el núcleo (vault + índice) y registra la API IPC antes de la ventana.
  servicios = inicializarServicios()
  historial = new HistorialService(servicios.vault, rutaHistorialPorEquipo())
  historial.capturar() // versión base del estado actual al arrancar
  registrarHandlersIpc(servicios)
  registrarHandlersAlmacenamiento(aplicarCambioAlmacenamiento)
  registrarHandlersHistorial(historial)
  registrarHandlersTerminal(servicios.vault.raiz)
  habilitarProtocoloRecurso(servicios.vault)

  createWindow()

  iniciarObservadorVault()

  app.on('activate', () => {
    // En macOS es habitual recrear la ventana al hacer clic en el icono del dock.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  // Detiene el observador, el terminal y cierra la conexión del índice.
  void sincronizador?.detener()
  cerrarTerminal()
  servicios?.repositorio.cerrar()
})
