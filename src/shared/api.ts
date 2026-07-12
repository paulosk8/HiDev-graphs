import type {
  AsignaturaDTO,
  ConceptoDTO,
  DatosAsignaturaDTO,
  DatosConceptoDTO,
  FichaConceptoDTO,
  ResultadoMaterialDTO,
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

  // --- Material ---
  /**
   * Devuelve la ruta absoluta de un archivo (para drag & drop / selector).
   * No es IPC: se resuelve en el preload con webUtils. Síncrono.
   */
  rutaDeArchivo(archivo: File): string
  agregarMaterial(conceptoId: string, rutas: string[]): Promise<Resultado<ResultadoMaterialDTO>>
  eliminarMaterial(conceptoId: string, recursoId: string): Promise<Resultado<ConceptoDTO>>

  // --- Asignaturas ---
  listarAsignaturas(): Promise<Resultado<ResumenAsignaturaDTO[]>>
  obtenerAsignatura(id: string): Promise<Resultado<AsignaturaDTO>>
  crearAsignatura(datos: DatosAsignaturaDTO): Promise<Resultado<ResumenAsignaturaDTO>>
  eliminarAsignatura(id: string): Promise<Resultado<void>>

  // --- Vínculos tema <-> concepto ---
  vincularTemaConcepto(
    asignaturaId: string,
    temaId: string,
    conceptoId: string
  ): Promise<Resultado<AsignaturaDTO>>
  desvincularTemaConcepto(
    asignaturaId: string,
    temaId: string,
    conceptoId: string
  ): Promise<Resultado<AsignaturaDTO>>

  // --- Sistema ---
  reindexar(): Promise<Resultado<ResultadoReindexadoDTO>>
}
