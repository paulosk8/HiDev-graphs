import type {
  ClienteMcpId,
  AsignaturaDTO,
  MaterialConceptoDTO,
  SemanaPlanDTO,
  ConceptoDTO,
  TipoRelacion,
  CalidadRepaso,
  CruceDTO,
  DatosAsignaturaDTO,
  DatosAsignaturaEdicionDTO,
  DatosConceptoDTO,
  DatosTareaDTO,
  CombinarTareasDTO,
  DuplicarTareaDTO,
  FichaConceptoDTO,
  GrafoDTO,
  McpInfoDTO,
  RespaldoDTO,
  RestauracionDTO,
  ResultadoAdjuntoDTO,
  ResultadoMaterialDTO,
  ResultadoReindexadoDTO,
  ResumenAsignaturaDTO,
  ResumenConceptoDTO,
  ResumenTareaDTO,
  SesionDTO,
  SincronizacionDTO,
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
  /** Registra un repaso del concepto (recuerdo activo) y devuelve su nuevo estado. */
  registrarRepaso(id: string, calidad: CalidadRepaso): Promise<Resultado<ConceptoDTO>>
  vincularConceptos(origenId: string, destinoId: string, tipo: TipoRelacion): Promise<Resultado<ConceptoDTO>>

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
  guardarPlanificacion(
    asignaturaId: string,
    periodo: string,
    semanas: SemanaPlanDTO[]
  ): Promise<Resultado<AsignaturaDTO>>
  obtenerMaterialDeConceptos(conceptoIds: string[]): Promise<Resultado<MaterialConceptoDTO[]>>
  crearAsignatura(datos: DatosAsignaturaDTO): Promise<Resultado<ResumenAsignaturaDTO>>
  /** Edita nombre, períodos, componentes y estructura (conserva ids de temas). */
  editarAsignatura(
    id: string,
    datos: DatosAsignaturaEdicionDTO
  ): Promise<Resultado<AsignaturaDTO>>
  eliminarAsignatura(id: string): Promise<Resultado<void>>
  agregarPeriodoAsignatura(id: string, periodo: string): Promise<Resultado<AsignaturaDTO>>
  quitarPeriodoAsignatura(id: string, periodo: string): Promise<Resultado<AsignaturaDTO>>

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
  crucesDeTarea(tareaId: string): Promise<Resultado<CruceDTO[]>>
  duplicarTarea(tareaId: string, destino: DuplicarTareaDTO): Promise<Resultado<TareaDTO>>
  combinarTareas(datos: CombinarTareasDTO): Promise<Resultado<TareaDTO>>

  // --- Grafo ---
  obtenerGrafo(): Promise<Resultado<GrafoDTO>>

  // --- Asistente IA (MCP) ---
  obtenerInfoMcp(): Promise<Resultado<McpInfoDTO>>
  conectarMcp(cli: ClienteMcpId): Promise<Resultado<McpInfoDTO>>

  // --- Autenticación ---
  /** Abre el navegador para iniciar sesión con Google. Resuelve con la sesión creada. */
  iniciarSesion(): Promise<Resultado<SesionDTO>>
  cerrarSesion(): Promise<Resultado<null>>
  /** Sesión activa (o null si nadie ha iniciado sesión). */
  sesionActual(): Promise<Resultado<SesionDTO | null>>
  /** Sincroniza el vault local con la nube (dos vías). */
  sincronizarNube(): Promise<Resultado<SincronizacionDTO>>

  // --- Sistema ---
  reindexar(): Promise<Resultado<ResultadoReindexadoDTO>>
  respaldar(): Promise<Resultado<RespaldoDTO>>
  restaurar(): Promise<Resultado<RestauracionDTO>>

  /**
   * Se suscribe a los cambios del vault detectados en segundo plano.
   * Devuelve una función para cancelar la suscripción.
   */
  onVaultCambiado(callback: () => void): () => void

  // --- Terminal embebida ---
  terminal: {
    crear(cols: number, rows: number): Promise<void>
    escribir(datos: string): void
    redimensionar(cols: number, rows: number): void
    cerrar(): void
    onDatos(callback: (datos: string) => void): () => void
    onSalida(callback: (codigo: number) => void): () => void
  }
}
