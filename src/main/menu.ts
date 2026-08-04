import { app, BrowserWindow, dialog, Menu, shell, type MenuItemConstructorOptions } from 'electron'

import { CANALES } from '../shared/canales'
import type { AccionMenu } from '../shared/dtos'

/**
 * Barra de menú de la aplicación, **en español** y con lenguaje de docente (la
 * de Electron viene en inglés y llena de opciones de programador).
 *
 * Casi todas las opciones son de interfaz (navegar, abrir un formulario): el
 * menú no las ejecuta, las **envía al renderer** por `menu:accion`, que las
 * resuelve con la misma API que los botones equivalentes. Así no hay dos
 * caminos distintos para la misma acción. Lo que sí es del sistema (abrir la
 * carpeta del material, "Acerca de") se hace aquí.
 */

/** Envía una acción al renderer; si no hay ventana, no hace nada. */
function enviar(accion: AccionMenu): void {
  const ventana = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (ventana && !ventana.isDestroyed()) ventana.webContents.send(CANALES.menuAccion, accion)
}

/** Atajo: un ítem de menú que solo manda una acción al renderer. */
function item(
  label: string,
  accion: AccionMenu,
  accelerator?: string
): MenuItemConstructorOptions {
  return { label, accelerator, click: () => enviar(accion) }
}

function mostrarAcercaDe(rutaVault: string): void {
  void dialog.showMessageBox({
    type: 'info',
    title: 'Acerca de PedagoGraph',
    message: `PedagoGraph ${app.getVersion()}`,
    detail: [
      'Organiza tu material por conceptos y reutilízalo entre asignaturas.',
      '',
      `Tu material se guarda en:\n${rutaVault}`
    ].join('\n'),
    buttons: ['Cerrar']
  })
}

/**
 * Construye e instala la barra de menú. `rutaVault` es una función porque la
 * carpeta del material puede cambiar en caliente (al pasarla a la nube).
 */
export function instalarMenu(rutaVault: () => string): void {
  const esMac = process.platform === 'darwin'

  const menuApp: MenuItemConstructorOptions[] = esMac
    ? [
        {
          label: 'PedagoGraph',
          submenu: [
            { label: 'Acerca de PedagoGraph', click: () => mostrarAcercaDe(rutaVault()) },
            { type: 'separator' },
            item('Configuración…', 'ir-configuracion', 'CmdOrCtrl+,'),
            { type: 'separator' },
            { role: 'services', label: 'Servicios' },
            { type: 'separator' },
            { role: 'hide', label: 'Ocultar PedagoGraph' },
            { role: 'hideOthers', label: 'Ocultar otros' },
            { role: 'unhide', label: 'Mostrar todo' },
            { type: 'separator' },
            { role: 'quit', label: 'Salir de PedagoGraph' }
          ]
        }
      ]
    : []

  const plantilla: MenuItemConstructorOptions[] = [
    ...menuApp,
    {
      label: 'Archivo',
      submenu: [
        item('Nuevo concepto…', 'nuevo-concepto', 'CmdOrCtrl+N'),
        item('Nueva asignatura…', 'nueva-asignatura', 'CmdOrCtrl+Shift+N'),
        { type: 'separator' },
        item('Guardar copia de seguridad…', 'respaldar', 'CmdOrCtrl+Shift+S'),
        item('Restaurar copia…', 'restaurar'),
        ...(esMac
          ? []
          : ([
              { type: 'separator' },
              item('Configuración…', 'ir-configuracion', 'CmdOrCtrl+,'),
              { role: 'quit', label: 'Salir' }
            ] as MenuItemConstructorOptions[]))
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        item('Asignaturas', 'ir-asignaturas', 'CmdOrCtrl+1'),
        item('Conceptos', 'ir-conceptos', 'CmdOrCtrl+2'),
        item('Mapa', 'ir-mapa', 'CmdOrCtrl+3'),
        item('Repaso', 'ir-repaso', 'CmdOrCtrl+4'),
        item('Asistente IA', 'ir-asistente', 'CmdOrCtrl+5'),
        { type: 'separator' },
        // No se usan los roles nativos de zoom: tendríamos dos mecanismos
        // distintos (el de Chromium y el control de Apariencia) pisándose. El
        // menú manda la acción y el tamaño lo gobierna un único sitio.
        item('Tamaño normal', 'zoom-normal', 'CmdOrCtrl+0'),
        item('Aumentar el tamaño', 'zoom-mas', 'CmdOrCtrl+Plus'),
        item('Reducir el tamaño', 'zoom-menos', 'CmdOrCtrl+-'),
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    },
    {
      label: 'Herramientas',
      submenu: [
        item('Actualizar mi material', 'actualizar-material', 'CmdOrCtrl+R'),
        {
          label: 'Abrir la carpeta de mi material',
          click: () => {
            void shell.openPath(rutaVault())
          }
        },
        { type: 'separator' },
        item('Terminal', 'ir-terminal')
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        { label: 'Acerca de PedagoGraph', click: () => mostrarAcercaDe(rutaVault()) },
        {
          label: 'Dónde se guarda mi material',
          click: () => enviar('ir-configuracion')
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(plantilla))
}
