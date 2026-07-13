import type { SupabaseAuthService } from './SupabaseAuthService'
import type { TablaAgregado } from './sincronizacion'
import { ErrorDeDominio } from '../domain/errores'

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
    const { data, error } = await cliente.from(tabla).select('id, datos, actualizado_en')
    if (error) {
      throw new ErrorDeDominio('No se pudieron leer tus datos de la nube.', error.message)
    }
    return (data ?? []).map((fila) => {
      const f = fila as { id: unknown; datos: unknown; actualizado_en: unknown }
      return {
        id: String(f.id),
        datos: (f.datos ?? {}) as Record<string, unknown>,
        actualizadoEnMs: Date.parse(String(f.actualizado_en)) || 0
      }
    })
  }

  /** Crea o actualiza un agregado (por su id). `user_id` lo pone la base de datos. */
  async guardar(tabla: TablaAgregado, id: string, datos: Record<string, unknown>): Promise<void> {
    const cliente = await this.auth.obtenerClienteAutenticado()
    const { error } = await cliente
      .from(tabla)
      .upsert({ id, datos }, { onConflict: 'user_id,id' })
    if (error) {
      throw new ErrorDeDominio('No se pudieron guardar tus datos en la nube.', error.message)
    }
  }

  /** Elimina un agregado por su id. */
  async eliminar(tabla: TablaAgregado, id: string): Promise<void> {
    const cliente = await this.auth.obtenerClienteAutenticado()
    const { error } = await cliente.from(tabla).delete().eq('id', id)
    if (error) {
      throw new ErrorDeDominio('No se pudo eliminar en la nube.', error.message)
    }
  }
}
