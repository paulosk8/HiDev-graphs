import type { SupabaseAuthService } from './SupabaseAuthService'
import { ErrorDeDominio } from '../domain/errores'

/** Tablas de agregados en la nube (una por tipo de dato). */
export type TablaAgregado = 'conceptos' | 'asignaturas' | 'tareas'

/** Un agregado tal cual viaja a/desde la nube: su id + el documento completo. */
export interface AgregadoNube {
  id: string
  datos: Record<string, unknown>
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
    const { data, error } = await cliente.from(tabla).select('id, datos')
    if (error) {
      throw new ErrorDeDominio('No se pudieron leer tus datos de la nube.', error.message)
    }
    return (data ?? []).map((fila) => ({
      id: String((fila as { id: unknown }).id),
      datos: ((fila as { datos: unknown }).datos ?? {}) as Record<string, unknown>
    }))
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
