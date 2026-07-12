import type {
  DatosConceptoDTO,
  FichaConceptoDTO,
  ResultadoReindexadoDTO,
  ResumenAsignaturaDTO,
  ResumenConceptoDTO,
  UsoDeConceptoDTO
} from './dtos'
import type { Resultado } from './resultado'

/**
 * Contrato de la API que el proceso main expone al renderer vía preload.
 *
 * Es la ÚNICA superficie entre renderer y backend. El renderer no contiene
 * lógica de negocio: solo llama a estos métodos. Cada método devuelve un
 * `Resultado<T>` (nunca lanza a través del puente). Se ampliará por bloques.
 */
export interface PedagoGraphApi {
  // --- Conceptos ---
  listarConceptos(): Promise<Resultado<ResumenConceptoDTO[]>>
  buscarConceptos(texto: string): Promise<Resultado<ResumenConceptoDTO[]>>
  usosDeConcepto(conceptoId: string): Promise<Resultado<UsoDeConceptoDTO[]>>
  obtenerFichaConcepto(conceptoId: string): Promise<Resultado<FichaConceptoDTO>>
  crearConcepto(datos: DatosConceptoDTO): Promise<Resultado<ResumenConceptoDTO>>
  editarConcepto(id: string, datos: DatosConceptoDTO): Promise<Resultado<ResumenConceptoDTO>>
  eliminarConcepto(id: string): Promise<Resultado<void>>

  // --- Asignaturas ---
  listarAsignaturas(): Promise<Resultado<ResumenAsignaturaDTO[]>>

  // --- Sistema ---
  reindexar(): Promise<Resultado<ResultadoReindexadoDTO>>
}
