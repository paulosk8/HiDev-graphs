import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { inicializarServicios, type Servicios } from './servicios'
import { registrarHandlersIpc } from './ipc/registrarHandlers'
import { IndexSyncService } from './infrastructure/IndexSyncService'
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

app.whenReady().then(() => {
  // Inicializa el núcleo (vault + índice) y registra la API IPC antes de la ventana.
  servicios = inicializarServicios()
  registrarHandlersIpc(servicios)
  habilitarProtocoloRecurso(servicios.vault)

  createWindow()

  // Mantiene el índice sincronizado con el vault y avisa al renderer.
  sincronizador = new IndexSyncService(servicios.vault, servicios.repositorio, () => {
    if (ventanaPrincipal && !ventanaPrincipal.isDestroyed()) {
      ventanaPrincipal.webContents.send(CANALES.vaultCambiado)
    }
  })
  sincronizador.iniciar()

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
  // Detiene el observador y cierra la conexión del índice de forma ordenada.
  void sincronizador?.detener()
  servicios?.repositorio.cerrar()
})
