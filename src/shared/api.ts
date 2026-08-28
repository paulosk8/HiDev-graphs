import type {
  AccionMenu,
  ClienteMcpId,
  AlmacenamientoDTO,
  CarpetaNubeDTO,
  MaterialEncontradoDTO,
  MaterialEnCarpetaDTO,
  EtiquetaDTO,
  LienzoDTO,
  ResumenLienzoDTO,
  ResumenMencionDTO,
  ResultadoAlmacenamientoDTO,
  EliminacionDTO,
  EstadoLecturaDTO,
  ModoEliminacion,
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
  DatosEnlaceMaterialDTO,
  DatosTerminoDTO,
  PromocionTerminoDTO,
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
  TareaDTO,
  UsoDeConceptoDTO,
  ItemHistorialDTO,
  VersionHistorialDTO,
  TablaHistorial
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
  /** Mueve un tema a otra unidad de la MISMA asignatura (conserva su id). */
  moverTema(
    asignaturaId: string,
    temaId: string,
    unidadDestinoId: string
  ): Promise<Resultado<AsignaturaDTO>>
  /** Mueve una nota a otro concepto. Devuelve el concepto de origen ya sin ella. */
  moverNota(
    conceptoOrigenId: string,
    notaId: string,
    conceptoDestinoId: string
  ): Promise<Resultado<ConceptoDTO>>
  // --- Lienzos ---
  listarLienzos(): Promise<Resultado<ResumenLienzoDTO[]>>
  /** Lienzos donde aparece este concepto (o su material). */
  lienzosDeConcepto(conceptoId: string): Promise<Resultado<ResumenLienzoDTO[]>>
  obtenerLienzo(id: string): Promise<Resultado<LienzoDTO>>
  crearLienzo(
    nombre: string,
    contexto?: 'docencia' | 'aprendizaje'
  ): Promise<Resultado<ResumenLienzoDTO>>
  /** Guarda el lienzo entero (posiciones y conexiones). */
  guardarLienzo(lienzo: LienzoDTO): Promise<Resultado<LienzoDTO>>
  eliminarLienzo(id: string): Promise<Resultado<void>>

  /** Otros conceptos que enlazan a este desde sus notas con [[Nombre]]. */
  obtenerMenciones(conceptoId: string): Promise<Resultado<ResumenMencionDTO[]>>
  /** Todas las etiquetas usadas, con cuántos conceptos las llevan. */
  listarEtiquetas(): Promise<Resultado<EtiquetaDTO[]>>
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
  agregarMaterial(
    conceptoId: string,
    rutas: string[],
    /** Carpeta destino dentro del concepto; vacío o ausente = raíz. */
    carpeta?: string
  ): Promise<Resultado<ResultadoMaterialDTO>>
  /** Carpetas de material existentes en un concepto. */
  listarCarpetasMaterial(conceptoId: string): Promise<Resultado<string[]>>
  /** Crea una carpeta vacía; devuelve la lista actualizada. */
  crearCarpetaMaterial(conceptoId: string, nombre: string): Promise<Resultado<string[]>>
  /** Cambia el nombre de una carpeta (mueve su material con ella). */
  renombrarCarpetaMaterial(
    conceptoId: string,
    actual: string,
    nuevo: string
  ): Promise<Resultado<ConceptoDTO>>
  /** Quita una carpeta y deja suelto su material (no lo elimina). */
  eliminarCarpetaMaterial(conceptoId: string, nombre: string): Promise<Resultado<ConceptoDTO>>
  /** Mueve un material a otra carpeta del concepto ('' = raíz). */
  moverMaterialACarpeta(
    conceptoId: string,
    recursoId: string,
    carpeta: string
  ): Promise<Resultado<ConceptoDTO>>
  eliminarMaterial(conceptoId: string, recursoId: string): Promise<Resultado<ConceptoDTO>>
  /** Abre un material con la aplicación predeterminada del sistema. */
  abrirMaterial(conceptoId: string, archivo: string): Promise<Resultado<void>>
  /** Lee el contenido de texto de un material (md/xml/html/txt) para previsualizar. */
  leerTextoMaterial(conceptoId: string, archivo: string): Promise<Resultado<string>>

  // --- Enlaces web (material que no es un archivo) ---
  agregarEnlaceMaterial(
    conceptoId: string,
    datos: DatosEnlaceMaterialDTO
  ): Promise<Resultado<ConceptoDTO>>
  editarEnlaceMaterial(
    conceptoId: string,
    enlaceId: string,
    datos: DatosEnlaceMaterialDTO
  ): Promise<Resultado<ConceptoDTO>>
  eliminarEnlaceMaterial(conceptoId: string, enlaceId: string): Promise<Resultado<ConceptoDTO>>
  agregarTermino(conceptoId: string, datos: DatosTerminoDTO): Promise<Resultado<ConceptoDTO>>
  editarTermino(
    conceptoId: string,
    terminoId: string,
    datos: DatosTerminoDTO
  ): Promise<Resultado<ConceptoDTO>>
  eliminarTermino(conceptoId: string, terminoId: string): Promise<Resultado<ConceptoDTO>>
  promoverTermino(
    conceptoId: string,
    terminoId: string
  ): Promise<Resultado<PromocionTerminoDTO>>
  /**
   * Guarda una imagen pegada en una nota junto al concepto y devuelve su ruta
   * relativa (`.imagenes/x.png`), que se escribe como `recurso://`.
   */
  guardarImagenDeNota(
    conceptoId: string,
    nombre: string,
    base64: string
  ): Promise<Resultado<{ archivo: string }>>
  /** Igual, pero trayendo la imagen de su dirección de origen (web o disco). */
  guardarImagenDeNotaDesdeUrl(
    conceptoId: string,
    url: string
  ): Promise<Resultado<{ archivo: string }>>
  /** Mueve un enlace a otra carpeta del concepto ('' = suelto). */
  moverEnlaceACarpeta(
    conceptoId: string,
    enlaceId: string,
    carpeta: string
  ): Promise<Resultado<ConceptoDTO>>

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

  // --- Almacenamiento del material (este equipo / carpeta de nube) ---
  /** Dónde se guarda hoy el material (para mostrarlo en Configuración). */
  estadoAlmacenamiento(): Promise<Resultado<AlmacenamientoDTO>>
  /** Carpetas de Google Drive / OneDrive detectadas en este equipo. */
  detectarCarpetasNube(): Promise<Resultado<CarpetaNubeDTO[]>>
  /** Qué material hay ya en `<contenedor>/<nombre>`, antes de confirmar. */
  inspeccionarCarpetaMaterial(
    rutaContenedor: string,
    nombreCarpeta: string
  ): Promise<Resultado<MaterialEnCarpetaDTO>>
  /** Quita (o devuelve) una ubicación de la lista al elegir dónde guardar. */
  ocultarUbicacion(ruta: string, oculta: boolean): Promise<Resultado<void>>
  /** Busca carpetas de material ya existentes en las nubes del equipo. */
  buscarMaterialExistente(): Promise<Resultado<MaterialEncontradoDTO[]>>
  /**
   * Abre el selector nativo del sistema para elegir (o crear) una carpeta donde
   * guardar el material. Devuelve la ruta elegida, o null si se cancela.
   */
  elegirCarpetaAlmacenamiento(): Promise<Resultado<string | null>>
  /**
   * Guarda el material en una carpeta de nube: crea `<rutaContenedor>/<nombreCarpeta>`,
   * copia el material y aplica el cambio en caliente (recarga la interfaz).
   */
  usarAlmacenamientoNube(
    rutaContenedor: string,
    nombreCarpeta: string,
    /** `abrir` usa el material que ya hay ahí; `mover` lleva el actual. */
    accion?: 'mover' | 'abrir'
  ): Promise<Resultado<ResultadoAlmacenamientoDTO>>
  /** Vuelve a guardar el material en este equipo (carpeta Documentos). */
  usarAlmacenamientoLocal(): Promise<Resultado<ResultadoAlmacenamientoDTO>>

  // --- Material que no se pudo leer ---
  /** Qué falta ahora mismo y por qué (0 elementos = todo se leyó bien). */
  estadoLectura(): Promise<Resultado<EstadoLecturaDTO>>
  /**
   * Vuelve a leer el material desde cero y devuelve el estado resultante.
   * Es lo que hay detrás del botón "Reintentar" del aviso.
   */
  reintentarLectura(): Promise<Resultado<EstadoLecturaDTO>>

  // --- Qué pasa al eliminar ---
  /** Preferencia actual + dónde está la carpeta de eliminados y si tiene algo. */
  estadoEliminacion(): Promise<Resultado<EliminacionDTO>>
  /** Cambia la preferencia; surte efecto en el siguiente borrado, sin reiniciar. */
  fijarModoEliminacion(modo: ModoEliminacion): Promise<Resultado<EliminacionDTO>>
  /** Abre la carpeta de eliminados en el explorador del sistema. */
  abrirCarpetaEliminados(): Promise<Resultado<void>>
  /** Vacía la carpeta de eliminados (definitivo). Devuelve el estado ya vacío. */
  vaciarEliminados(): Promise<Resultado<EliminacionDTO>>

  // --- Historial de versiones ---
  /** Elementos que tienen historial (han cambiado al menos una vez). */
  listarHistorial(): Promise<Resultado<ItemHistorialDTO[]>>
  /** Versiones de un elemento, de la más reciente a la más antigua. */
  versionesHistorial(tabla: TablaHistorial, id: string): Promise<Resultado<VersionHistorialDTO[]>>
  /** Restaura una versión anterior de un elemento. */
  restaurarVersion(tabla: TablaHistorial, id: string, versionId: string): Promise<Resultado<void>>

  // --- Sistema ---
  reindexar(): Promise<Resultado<ResultadoReindexadoDTO>>
  respaldar(): Promise<Resultado<RespaldoDTO>>
  restaurar(): Promise<Resultado<RestauracionDTO>>

  /**
   * Se suscribe a los cambios del vault detectados en segundo plano.
   * Devuelve una función para cancelar la suscripción.
   */
  onVaultCambiado(callback: () => void): () => void

  /**
   * Se suscribe a los cambios en el material que no se pudo leer (p. ej. la
   * nube vuelve y deja de faltar, o se cae y empieza a faltar).
   * Devuelve una función para cancelar la suscripción.
   */
  onLecturaCambiada(callback: (estado: EstadoLecturaDTO) => void): () => void

  /**
   * Se suscribe a las acciones elegidas en la barra de menú del sistema.
   * Devuelve una función para cancelar la suscripción.
   */
  onAccionMenu(callback: (accion: AccionMenu) => void): () => void

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
