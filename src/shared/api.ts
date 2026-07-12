import type {
  AsignaturaDTO,
  ConceptoDTO,
  DatosAsignaturaDTO,
  DatosConceptoDTO,
  DatosTareaDTO,
  FichaConceptoDTO,
  RespaldoDTO,
  ResultadoAdjuntoDTO,
  ResultadoMaterialDTO,
  ResultadoReindexadoDTO,
  ResumenAsignaturaDTO,
  ResumenConceptoDTO,
  ResumenTareaDTO,
  TareaDTO,
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
  /** Abre un material con la aplicación predeterminada del sistema. */
  abrirMaterial(conceptoId: string, archivo: string): Promise<Resultado<void>>
  /** Lee el contenido de texto de un material (md/xml/html/txt) para previsualizar. */
  leerTextoMaterial(conceptoId: string, archivo: string): Promise<Resultado<string>>

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

  // --- Tareas ---
  listarTareasDeAsignatura(asignaturaId: string): Promise<Resultado<ResumenTareaDTO[]>>
  listarTareasDeConcepto(conceptoId: string): Promise<Resultado<ResumenTareaDTO[]>>
  obtenerTarea(id: string): Promise<Resultado<TareaDTO>>
  crearTarea(datos: DatosTareaDTO): Promise<Resultado<TareaDTO>>
  editarTarea(id: string, datos: DatosTareaDTO): Promise<Resultado<TareaDTO>>
  eliminarTarea(id: string): Promise<Resultado<void>>
  agregarAdjuntoTarea(tareaId: string, rutas: string[]): Promise<Resultado<ResultadoAdjuntoDTO>>
  eliminarAdjuntoTarea(tareaId: string, recursoId: string): Promise<Resultado<TareaDTO>>
  abrirAdjuntoTarea(tareaId: string, archivo: string): Promise<Resultado<void>>

  // --- Sistema ---
  reindexar(): Promise<Resultado<ResultadoReindexadoDTO>>
  respaldar(): Promise<Resultado<RespaldoDTO>>

  /**
   * Se suscribe a los cambios del vault detectados en segundo plano.
   * Devuelve una función para cancelar la suscripción.
   */
  onVaultCambiado(callback: () => void): () => void
}
