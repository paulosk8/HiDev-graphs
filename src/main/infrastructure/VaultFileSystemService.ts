import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, copyFileSync } from 'node:fs'
import { basename, extname, join, resolve, sep } from 'node:path'
import { load as leerYaml, dump as escribirYaml } from 'js-yaml'

import { crearAsignatura, crearComponente, type Asignatura } from '../domain/Asignatura'
import { crearConcepto, type Concepto } from '../domain/Concepto'
import { crearRecurso } from '../domain/Recurso'
import { crearRelacion } from '../domain/Relacion'
import { crearSubtema } from '../domain/Subtema'
import { crearTarea, type Tarea } from '../domain/Tarea'
import { crearTema, type Tema } from '../domain/Tema'
import { crearUnidad, type Unidad } from '../domain/Unidad'
import {
  esTipoRelacion,
  formatoDesdeNombreArchivo,
  type FormatoRecurso,
  type TipoRelacion
} from '../domain/tipos'

/**
 * Fuente de verdad en el sistema de archivos: el "vault" con YAML.
 *
 * Estructura:
 *   <vault>/conceptos/<slug>/concepto.yaml  (+ archivos de material)
 *   <vault>/asignaturas/<slug>/pea.yaml
 *   <vault>/.index/                          (índice SQLite, gestionado aparte)
 *
 * Esta clase es agnóstica de Electron: recibe la ruta del vault ya resuelta.
 * El docente nunca ve estos archivos: la app los escribe y lee por él.
 */
export class VaultFileSystemService {
  constructor(private readonly rutaVault: string) {}

  get raiz(): string {
    return this.rutaVault
  }
  get dirConceptos(): string {
    return join(this.rutaVault, 'conceptos')
  }
  get dirAsignaturas(): string {
    return join(this.rutaVault, 'asignaturas')
  }
  get dirTareas(): string {
    return join(this.rutaVault, 'tareas')
  }
  get dirIndice(): string {
    return join(this.rutaVault, '.index')
  }
  get rutaBaseDatos(): string {
    return join(this.dirIndice, 'index.db')
  }

  /** Crea la estructura de carpetas del vault si aún no existe (cero configuración). */
  asegurarVault(): void {
    mkdirSync(this.dirConceptos, { recursive: true })
    mkdirSync(this.dirAsignaturas, { recursive: true })
    mkdirSync(this.dirTareas, { recursive: true })
    mkdirSync(this.dirIndice, { recursive: true })
  }

  // ---------------------------------------------------------------------------
  // Conceptos
  // ---------------------------------------------------------------------------

  carpetaConcepto(id: string): string {
    return join(this.dirConceptos, id)
  }

  private rutaConcepto(id: string): string {
    return join(this.carpetaConcepto(id), 'concepto.yaml')
  }

  existeConcepto(id: string): boolean {
    return existsSync(this.rutaConcepto(id))
  }

  guardarConcepto(concepto: Concepto): void {
    mkdirSync(this.carpetaConcepto(concepto.id), { recursive: true })
    const plano = {
      id: concepto.id,
      nombre: concepto.nombre,
      descripcion: concepto.descripcion,
      relaciones: concepto.relaciones.map((r) => ({ destino: r.destino, tipo: r.tipo })),
      recursos: concepto.recursos.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        archivo: r.archivo,
        formato: r.formato
      }))
    }
    writeFileSync(this.rutaConcepto(concepto.id), escribirYaml(plano, { lineWidth: 100 }), 'utf8')
  }

  leerConcepto(id: string): Concepto {
    const datos = leerYaml(readFileSync(this.rutaConcepto(id), 'utf8')) as Record<string, unknown>
    return conceptoDesdePlano(datos)
  }

  listarIdsConceptos(): string[] {
    return this.subcarpetasCon(this.dirConceptos, 'concepto.yaml')
  }

  leerTodosConceptos(): Concepto[] {
    return this.listarIdsConceptos()
      .map((id) => this.leerToleranteConcepto(id))
      .filter((c): c is Concepto => c !== null)
  }

  eliminarConcepto(id: string): void {
    rmSync(this.carpetaConcepto(id), { recursive: true, force: true })
  }

  /**
   * Copia un archivo de material dentro de la carpeta del concepto y devuelve
   * el nombre de archivo final (resolviendo colisiones) y su formato.
   */
  copiarRecurso(conceptoId: string, rutaOrigen: string): { archivo: string; formato: FormatoRecurso } {
    const formato = formatoDesdeNombreArchivo(rutaOrigen)
    if (formato === null) {
      throw new Error(`Formato de material no soportado: ${extname(rutaOrigen) || '(sin extensión)'}`)
    }
    mkdirSync(this.carpetaConcepto(conceptoId), { recursive: true })
    const archivo = this.nombreLibreEn(this.carpetaConcepto(conceptoId), basename(rutaOrigen))
    copyFileSync(rutaOrigen, join(this.carpetaConcepto(conceptoId), archivo))
    return { archivo, formato }
  }

  /**
   * Ruta absoluta de un archivo de material, validada para que quede DENTRO de
   * la carpeta de conceptos (evita salir del vault con "../"). Devuelve null si
   * la ruta escapa del vault.
   */
  rutaRecurso(conceptoId: string, archivo: string): string | null {
    const abs = resolve(this.carpetaConcepto(conceptoId), archivo)
    const base = resolve(this.dirConceptos)
    return abs === base || abs.startsWith(base + sep) ? abs : null
  }

  existeRecurso(conceptoId: string, archivo: string): boolean {
    const ruta = this.rutaRecurso(conceptoId, archivo)
    return ruta !== null && existsSync(ruta)
  }

  /** Lee el contenido de texto de un material (para previsualizar md/xml/html). */
  leerTextoRecurso(conceptoId: string, archivo: string): string {
    const ruta = this.rutaRecurso(conceptoId, archivo)
    if (ruta === null || !existsSync(ruta)) {
      throw new Error(`No se encontró el material: ${archivo}`)
    }
    return readFileSync(ruta, 'utf8')
  }

  /** Borra el archivo físico de un material dentro de la carpeta del concepto. */
  eliminarArchivoRecurso(conceptoId: string, archivo: string): void {
    const ruta = join(this.carpetaConcepto(conceptoId), archivo)
    if (existsSync(ruta)) rmSync(ruta, { force: true })
  }

  private leerToleranteConcepto(id: string): Concepto | null {
    try {
      return this.leerConcepto(id)
    } catch (error) {
      console.warn(`No se pudo leer el concepto "${id}":`, error)
      return null
    }
  }

  /** Nombre de archivo libre dentro de `carpeta` (añade -2, -3… si colisiona). */
  private nombreLibreEn(carpeta: string, deseado: string): string {
    if (!existsSync(join(carpeta, deseado))) return deseado

    const ext = extname(deseado)
    const base = deseado.slice(0, deseado.length - ext.length)
    let n = 2
    while (existsSync(join(carpeta, `${base}-${n}${ext}`))) n += 1
    return `${base}-${n}${ext}`
  }

  // ---------------------------------------------------------------------------
  // Asignaturas
  // ---------------------------------------------------------------------------

  carpetaAsignatura(id: string): string {
    return join(this.dirAsignaturas, id)
  }

  private rutaAsignatura(id: string): string {
    return join(this.carpetaAsignatura(id), 'pea.yaml')
  }

  existeAsignatura(id: string): boolean {
    return existsSync(this.rutaAsignatura(id))
  }

  guardarAsignatura(asignatura: Asignatura): void {
    mkdirSync(this.carpetaAsignatura(asignatura.id), { recursive: true })
    const plano = {
      id: asignatura.id,
      nombre: asignatura.nombre,
      periodos: [...asignatura.periodos],
      componentes: asignatura.componentes.map((c) => ({ clave: c.clave, nombre: c.nombre })),
      unidades: asignatura.unidades.map((u) => ({
        id: u.id,
        titulo: u.titulo,
        orden: u.orden,
        temas: u.temas.map((t) => ({
          id: t.id,
          titulo: t.titulo,
          orden: t.orden,
          semana: t.semana,
          subtemas: t.subtemas.map((s) => ({ id: s.id, titulo: s.titulo, orden: s.orden })),
          conceptos: [...t.conceptos]
        }))
      }))
    }
    writeFileSync(this.rutaAsignatura(asignatura.id), escribirYaml(plano, { lineWidth: 100 }), 'utf8')
  }

  leerAsignatura(id: string): Asignatura {
    const datos = leerYaml(readFileSync(this.rutaAsignatura(id), 'utf8')) as Record<string, unknown>
    return asignaturaDesdePlano(datos)
  }

  listarIdsAsignaturas(): string[] {
    return this.subcarpetasCon(this.dirAsignaturas, 'pea.yaml')
  }

  leerTodasAsignaturas(): Asignatura[] {
    return this.listarIdsAsignaturas()
      .map((id) => this.leerToleranteAsignatura(id))
      .filter((a): a is Asignatura => a !== null)
  }

  eliminarAsignatura(id: string): void {
    rmSync(this.carpetaAsignatura(id), { recursive: true, force: true })
  }

  private leerToleranteAsignatura(id: string): Asignatura | null {
    try {
      return this.leerAsignatura(id)
    } catch (error) {
      console.warn(`No se pudo leer la asignatura "${id}":`, error)
      return null
    }
  }

  // ---------------------------------------------------------------------------
  // Tareas (capa transversal)
  // ---------------------------------------------------------------------------

  carpetaTarea(id: string): string {
    return join(this.dirTareas, id)
  }
  private rutaTarea(id: string): string {
    return join(this.carpetaTarea(id), 'tarea.yaml')
  }
  private rutaInstrucciones(id: string, formato: 'markdown' | 'html'): string {
    return join(this.carpetaTarea(id), formato === 'html' ? 'instrucciones.html' : 'instrucciones.md')
  }

  existeTarea(id: string): boolean {
    return existsSync(this.rutaTarea(id))
  }

  guardarTarea(tarea: Tarea): void {
    mkdirSync(this.carpetaTarea(tarea.id), { recursive: true })
    const plano = {
      id: tarea.id,
      titulo: tarea.titulo,
      formato: tarea.formato,
      asignaturaId: tarea.asignaturaId,
      temas: [...tarea.temas],
      componente: tarea.componente,
      conceptos: [...tarea.conceptos],
      recursos: tarea.recursos.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        archivo: r.archivo,
        formato: r.formato
      })),
      enlaces: tarea.enlaces.map((e) => ({ url: e.url, titulo: e.titulo }))
    }
    writeFileSync(this.rutaTarea(tarea.id), escribirYaml(plano, { lineWidth: 100 }), 'utf8')
    // Las instrucciones van en su propio archivo (.md o .html), legible y descargable.
    writeFileSync(this.rutaInstrucciones(tarea.id, tarea.formato), tarea.instrucciones, 'utf8')
    // Si cambió el formato, elimina el archivo del otro formato para no dejar residuos.
    const otro = this.rutaInstrucciones(tarea.id, tarea.formato === 'html' ? 'markdown' : 'html')
    if (existsSync(otro)) rmSync(otro, { force: true })
  }

  leerTarea(id: string): Tarea {
    const datos = leerYaml(readFileSync(this.rutaTarea(id), 'utf8')) as Record<string, unknown>
    const formato = datos.formato === 'html' ? 'html' : 'markdown'
    const ruta = this.rutaInstrucciones(id, formato)
    // Compatibilidad: si no existe el del formato indicado, prueba el otro.
    const rutaOtro = this.rutaInstrucciones(id, formato === 'html' ? 'markdown' : 'html')
    const rutaLeer = existsSync(ruta) ? ruta : existsSync(rutaOtro) ? rutaOtro : null
    const instrucciones = rutaLeer ? readFileSync(rutaLeer, 'utf8') : ''
    return tareaDesdePlano(datos, instrucciones)
  }

  listarIdsTareas(): string[] {
    return this.subcarpetasCon(this.dirTareas, 'tarea.yaml')
  }

  leerTodasTareas(): Tarea[] {
    return this.listarIdsTareas()
      .map((id) => {
        try {
          return this.leerTarea(id)
        } catch (error) {
          console.warn(`No se pudo leer la tarea "${id}":`, error)
          return null
        }
      })
      .filter((t): t is Tarea => t !== null)
  }

  eliminarTarea(id: string): void {
    rmSync(this.carpetaTarea(id), { recursive: true, force: true })
  }

  /** Copia un adjunto dentro de la carpeta de la tarea. */
  copiarAdjuntoTarea(tareaId: string, rutaOrigen: string): { archivo: string; formato: FormatoRecurso } {
    const formato = formatoDesdeNombreArchivo(rutaOrigen)
    if (formato === null) {
      throw new Error(`Formato de adjunto no soportado: ${extname(rutaOrigen) || '(sin extensión)'}`)
    }
    mkdirSync(this.carpetaTarea(tareaId), { recursive: true })
    const archivo = this.nombreLibreEn(this.carpetaTarea(tareaId), basename(rutaOrigen))
    copyFileSync(rutaOrigen, join(this.carpetaTarea(tareaId), archivo))
    return { archivo, formato }
  }

  eliminarArchivoAdjuntoTarea(tareaId: string, archivo: string): void {
    const ruta = join(this.carpetaTarea(tareaId), archivo)
    if (existsSync(ruta)) rmSync(ruta, { force: true })
  }

  /** Ruta absoluta validada de un adjunto de tarea (dentro del vault). */
  rutaAdjuntoTarea(tareaId: string, archivo: string): string | null {
    const abs = resolve(this.carpetaTarea(tareaId), archivo)
    const base = resolve(this.dirTareas)
    return abs === base || abs.startsWith(base + sep) ? abs : null
  }

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------

  /** Devuelve las subcarpetas de `dir` que contienen el archivo `marcador`. */
  private subcarpetasCon(dir: string, marcador: string): string[] {
    if (!existsSync(dir)) return []
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, marcador)))
      .map((e) => e.name)
  }
}

// -----------------------------------------------------------------------------
// Reconstrucción de entidades desde datos planos de YAML (con validación)
// -----------------------------------------------------------------------------

function texto(valor: unknown, defecto = ''): string {
  return typeof valor === 'string' ? valor : defecto
}

function lista(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : []
}

function numero(valor: unknown, defecto: number): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : defecto
}

function conceptoDesdePlano(datos: Record<string, unknown>): Concepto {
  const relaciones = lista(datos.relaciones)
    .map((r) => r as Record<string, unknown>)
    .filter((r) => esTipoRelacion(texto(r.tipo)))
    .map((r) => crearRelacion({ destino: texto(r.destino), tipo: texto(r.tipo) as TipoRelacion }))

  const recursos = lista(datos.recursos)
    .map((r) => r as Record<string, unknown>)
    .map((r) =>
      crearRecurso({
        id: texto(r.id),
        nombre: texto(r.nombre),
        archivo: texto(r.archivo),
        formato: (formatoDesdeNombreArchivo(texto(r.archivo)) ?? texto(r.formato)) as FormatoRecurso
      })
    )

  return crearConcepto({
    id: texto(datos.id),
    nombre: texto(datos.nombre),
    descripcion: texto(datos.descripcion),
    relaciones,
    recursos
  })
}

function asignaturaDesdePlano(datos: Record<string, unknown>): Asignatura {
  const componentes = lista(datos.componentes)
    .map((c) => c as Record<string, unknown>)
    .map((c) => crearComponente({ clave: texto(c.clave), nombre: texto(c.nombre) }))

  const unidades: Unidad[] = lista(datos.unidades)
    .map((u) => u as Record<string, unknown>)
    .map((u, i) => {
      const temas: Tema[] = lista(u.temas)
        .map((t) => t as Record<string, unknown>)
        .map((t, j) => {
          const subtemas = lista(t.subtemas)
            .map((s) => s as Record<string, unknown>)
            .map((s, k) =>
              crearSubtema({ id: texto(s.id), titulo: texto(s.titulo), orden: numero(s.orden, k + 1) })
            )
          const conceptos = lista(t.conceptos).map((id) => texto(id)).filter((id) => id.length > 0)
          return crearTema({
            id: texto(t.id),
            titulo: texto(t.titulo),
            orden: numero(t.orden, j + 1),
            semana: typeof t.semana === 'number' ? t.semana : null,
            subtemas,
            conceptos
          })
        })
      return crearUnidad({ id: texto(u.id), titulo: texto(u.titulo), orden: numero(u.orden, i + 1), temas })
    })

  // Compatibilidad: acepta `periodos` (lista) o el antiguo `periodo` (texto).
  const periodos = Array.isArray(datos.periodos)
    ? lista(datos.periodos).map((p) => texto(p)).filter((p) => p.length > 0)
    : texto(datos.periodo)
      ? [texto(datos.periodo)]
      : []

  return crearAsignatura({
    id: texto(datos.id),
    nombre: texto(datos.nombre),
    periodos,
    componentes,
    unidades
  })
}

function tareaDesdePlano(datos: Record<string, unknown>, instrucciones: string): Tarea {
  const listaTextos = (v: unknown): string[] =>
    lista(v).map((x) => texto(x)).filter((x) => x.length > 0)

  const recursos = lista(datos.recursos)
    .map((r) => r as Record<string, unknown>)
    .map((r) =>
      crearRecurso({
        id: texto(r.id),
        nombre: texto(r.nombre),
        archivo: texto(r.archivo),
        formato: (formatoDesdeNombreArchivo(texto(r.archivo)) ?? texto(r.formato)) as FormatoRecurso
      })
    )

  const enlaces = lista(datos.enlaces)
    .map((e) => e as Record<string, unknown>)
    .map((e) => ({ url: texto(e.url), titulo: texto(e.titulo) }))

  const componente = texto(datos.componente)
  return crearTarea({
    id: texto(datos.id),
    titulo: texto(datos.titulo),
    instrucciones,
    formato: datos.formato === 'html' ? 'html' : 'markdown',
    asignaturaId: texto(datos.asignaturaId),
    temas: listaTextos(datos.temas),
    componente: componente.length > 0 ? componente : null,
    conceptos: listaTextos(datos.conceptos),
    recursos,
    enlaces
  })
}
