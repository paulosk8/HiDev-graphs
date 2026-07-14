import { ipcMain } from 'electron'

import { CANALES } from '../../shared/canales'
import type { ConflictoDTO, EleccionConflicto, SincronizacionDTO } from '../../shared/dtos'
import type { EleccionConflicto as EleccionInterna, SyncService } from '../infrastructure/SyncService'
import type { VaultFileSystemService } from '../infrastructure/VaultFileSystemService'
import type { ConflictoGuardado, TablaAgregado } from '../infrastructure/sincronizacion'
import { envolver } from './registrarHandlers'

const ETIQUETA_TABLA: Record<TablaAgregado, string> = {
  conceptos: 'Concepto',
  asignaturas: 'Asignatura',
  tareas: 'Tarea'
}

/** Cuenta los elementos de un campo array del agregado (0 si no existe). */
function cuantos(datos: Record<string, unknown>, campo: string): number {
  const v = datos[campo]
  return Array.isArray(v) ? v.length : 0
}

/** Resumen legible de una versión del ítem, según su tipo. */
function resumen(tabla: TablaAgregado, datos: Record<string, unknown>): string {
  const texto = (k: string): string => (typeof datos[k] === 'string' ? (datos[k] as string) : '')
  if (tabla === 'tareas') {
    const desc = texto('instrucciones').trim().slice(0, 80)
    const temas = cuantos(datos, 'temas')
    return [texto('titulo') || 'Tarea', desc, temas ? `${temas} temas` : '']
      .filter(Boolean)
      .join(' — ')
  }
  if (tabla === 'asignaturas') {
    const unidades = cuantos(datos, 'unidades')
    return [texto('nombre') || 'Asignatura', unidades ? `${unidades} temas` : '']
      .filter(Boolean)
      .join(' · ')
  }
  // conceptos
  const extras = [
    cuantos(datos, 'recursos') ? `${cuantos(datos, 'recursos')} materiales` : '',
    cuantos(datos, 'notas') ? `${cuantos(datos, 'notas')} notas` : '',
    cuantos(datos, 'relaciones') ? `${cuantos(datos, 'relaciones')} relaciones` : ''
  ].filter(Boolean)
  return [texto('nombre') || 'Concepto', texto('descripcion'), extras.join(' · ')]
    .filter(Boolean)
    .join(' — ')
}

function nombreDe(datos: Record<string, unknown>): string {
  return (
    (typeof datos.nombre === 'string' && datos.nombre) ||
    (typeof datos.titulo === 'string' && datos.titulo) ||
    'Sin nombre'
  )
}

function aDTO(c: ConflictoGuardado): ConflictoDTO {
  return {
    id: c.id,
    tabla: c.tabla,
    tipoEtiqueta: ETIQUETA_TABLA[c.tabla],
    titulo: nombreDe(c.local),
    local: { resumen: resumen(c.tabla, c.local), editadoEnMs: c.mtimeLocalMs },
    nube: { resumen: resumen(c.tabla, c.remoto), editadoEnMs: c.actualizadoRemotoMs }
  }
}

/** Conecta los canales de nube: sincronizar, listar y resolver conflictos. */
export function registrarHandlersNube(sync: SyncService, vault: VaultFileSystemService): void {
  ipcMain.handle(CANALES.nubeSincronizar, () =>
    envolver<SincronizacionDTO>(() => sync.sincronizar())
  )

  ipcMain.handle(CANALES.conflictosListar, () =>
    envolver<ConflictoDTO[]>(() => vault.leerConflictos().map(aDTO))
  )

  ipcMain.handle(
    CANALES.conflictosResolver,
    (_evento, tabla: TablaAgregado, id: string, eleccion: EleccionConflicto) =>
      envolver<null>(async () => {
        await sync.resolverConflicto(tabla, id, eleccion as EleccionInterna)
        return null
      })
  )
}
