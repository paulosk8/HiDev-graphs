import type { PostgrestError } from '@supabase/supabase-js'

import type { SupabaseAuthService } from './SupabaseAuthService'
import type { TablaAgregado } from './sincronizacion'
import { ErrorDeDominio } from '../domain/errores'

/** Resume un error de Supabase (mensaje + código/pista) para poder diagnosticar. */
function detalle(error: PostgrestError): string {
  return [error.message, error.details, error.hint, error.code]
    .filter((x) => x)
    .join(' · ')
}

/**
 * Tope de tiempo por operación de red (ms). Sin él, si la nube no responde el
 * `await` queda pendiente hasta el timeout por defecto de fetch → la
 * sincronización se cuelga. Con esto falla rápido y la app sigue con lo local.
 */
const TIEMPO_MAX_MS = 15000

/** Un agregado tal cual viaja a/desde la nube: su id, documento y marca de tiempo. */
export interface AgregadoNube {
  id: string
  datos: Record<string, unknown>
  actualizadoEnMs: number
}

/**
 * Acceso a los datos estructurados del usuario en Supabase (Postgres).
 *
 * Trabaja con "agregados" opacos (`{ id, datos }`), donde `datos` es el mismo
 * documento JSON que el YAML del vault local. NO conoce el dominio: solo mueve
 * JSON. La seguridad la impone Row-Level Security con la sesión del usuario, por
 * eso todas las operaciones usan el cliente autenticado.
 *
 * Los archivos de material NO viajan por aquí: siguen siendo locales.
 */
export class SupabaseDataService {
  constructor(private readonly auth: SupabaseAuthService) {}

  /** Devuelve todos los agregados del usuario en una tabla. */
  async listar(tabla: TablaAgregado): Promise<AgregadoNube[]> {
    const cliente = await this.auth.obtenerClienteAutenticado()
    const mensaje = 'No se pudieron leer tus datos de la nube.'
    try {
      const { data, error } = await cliente
        .from(tabla)
        .select('id, datos, actualizado_en')
        .abortSignal(this.senal())
      if (error) throw new ErrorDeDominio(mensaje, detalle(error))
      return (data ?? []).map((fila) => {
        const f = fila as { id: unknown; datos: unknown; actualizado_en: unknown }
        return {
          id: String(f.id),
          datos: (f.datos ?? {}) as Record<string, unknown>,
          actualizadoEnMs: Date.parse(String(f.actualizado_en)) || 0
        }
      })
    } catch (e) {
      throw this.aErrorRed(e, mensaje)
    }
  }

  /** Crea o actualiza un agregado (por su id). `user_id` lo pone la base de datos. */
  async guardar(tabla: TablaAgregado, id: string, datos: Record<string, unknown>): Promise<void> {
    const cliente = await this.auth.obtenerClienteAutenticado()
    const mensaje = 'No se pudieron guardar tus datos en la nube.'
    try {
      const { error } = await cliente
        .from(tabla)
        .upsert({ id, datos }, { onConflict: 'user_id,id' })
        .abortSignal(this.senal())
      if (error) throw new ErrorDeDominio(mensaje, detalle(error))
    } catch (e) {
      throw this.aErrorRed(e, mensaje)
    }
  }

  /** Elimina un agregado por su id. */
  async eliminar(tabla: TablaAgregado, id: string): Promise<void> {
    const cliente = await this.auth.obtenerClienteAutenticado()
    const mensaje = 'No se pudo eliminar en la nube.'
    try {
      const { error } = await cliente.from(tabla).delete().eq('id', id).abortSignal(this.senal())
      if (error) throw new ErrorDeDominio(mensaje, detalle(error))
    } catch (e) {
      throw this.aErrorRed(e, mensaje)
    }
  }

  // --- Internos ---

  /** Señal que aborta la consulta si la nube no responde a tiempo. */
  private senal(): AbortSignal {
    return AbortSignal.timeout(TIEMPO_MAX_MS)
  }

  /** Normaliza cualquier fallo (timeout/red o error ya tipado) a un error humano. */
  private aErrorRed(e: unknown, mensaje: string): ErrorDeDominio {
    if (e instanceof ErrorDeDominio) return e
    const causa = e instanceof Error ? e.message : 'Sin conexión con la nube.'
    return new ErrorDeDominio(mensaje, causa)
  }
}
