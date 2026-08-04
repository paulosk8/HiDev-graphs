/**
 * Siembra un conjunto PEQUEÑO de datos de prueba: 5 conceptos conectados entre
 * sí por relaciones tipadas (prerequisito_de / relacionado_con / profundiza),
 * para probar el Mapa (grafo), la ficha de concepto y el historial de cambios.
 *
 * Apunta al vault ACTIVO (lee la config del usuario: nube o local). Es aditivo:
 * los conceptos solo se crean si aún no existen. Ejecutar con:
 *   npx esbuild scripts/sembrar-prueba.ts --bundle --platform=node --format=cjs \
 *     --external:js-yaml --outfile=node_modules/.cache/seed-prueba.cjs \
 *     && node node_modules/.cache/seed-prueba.cjs
 */
import { homedir } from 'node:os'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { VaultFileSystemService } from '../src/main/infrastructure/VaultFileSystemService'
import { crearConcepto } from '../src/main/domain/Concepto'
import { crearRelacion } from '../src/main/domain/Relacion'
import { crearComponente, crearAsignatura } from '../src/main/domain/Asignatura'
import { crearUnidad, agregarTema, type Unidad } from '../src/main/domain/Unidad'
import { crearTema, vincularConcepto, type Tema } from '../src/main/domain/Tema'
import type { TipoRelacion } from '../src/main/domain/tipos'

/** Resuelve la carpeta del vault desde la config de la app (nube o local). */
function resolverRutaVault(): string {
  const porDefecto = join(homedir(), 'Documents', 'PedagoGraph')
  try {
    // userData en macOS: ~/Library/Application Support/PedagoGraph
    const config = join(homedir(), 'Library', 'Application Support', 'PedagoGraph', 'config.json')
    if (!existsSync(config)) return porDefecto
    const o = JSON.parse(readFileSync(config, 'utf8')) as {
      modoAlmacenamiento?: string
      rutaVaultNube?: string
    }
    if (o.modoAlmacenamiento === 'nube' && typeof o.rutaVaultNube === 'string') {
      return o.rutaVaultNube
    }
    return porDefecto
  } catch {
    return porDefecto
  }
}

const rutaVault = resolverRutaVault()
const vault = new VaultFileSystemService(rutaVault)
vault.asegurarVault()

const rel = (destino: string, tipo: TipoRelacion): ReturnType<typeof crearRelacion> =>
  crearRelacion({ destino, tipo })

// 5 conceptos conectados: variables → funciones → recursividad → divide-y-venceras
// → ordenamiento, con enlaces cruzados para que el grafo quede bien conectado.
const conceptos = [
  {
    id: 'variables',
    nombre: 'Variables',
    descripcion: 'Espacios con nombre que guardan un valor.',
    relaciones: [rel('funciones', 'prerequisito_de')]
  },
  {
    id: 'funciones',
    nombre: 'Funciones',
    descripcion: 'Bloques reutilizables que reciben entradas y devuelven un resultado.',
    relaciones: [rel('recursividad', 'prerequisito_de'), rel('ordenamiento', 'relacionado_con')]
  },
  {
    id: 'recursividad',
    nombre: 'Recursividad',
    descripcion: 'Definir algo en términos de sí mismo (caso base + caso recursivo).',
    relaciones: [rel('divide-y-venceras', 'prerequisito_de'), rel('ordenamiento', 'relacionado_con')]
  },
  {
    id: 'divide-y-venceras',
    nombre: 'Divide y vencerás',
    descripcion: 'Dividir un problema en subproblemas, resolverlos y combinar.',
    relaciones: [rel('ordenamiento', 'profundiza')]
  },
  {
    id: 'ordenamiento',
    nombre: 'Ordenamiento',
    descripcion: 'Reorganizar elementos según un criterio (p. ej. merge sort).',
    relaciones: []
  }
] as const

let creados = 0
for (const c of conceptos) {
  if (vault.existeConcepto(c.id)) {
    console.log(`  · "${c.nombre}" ya existe, se conserva.`)
    continue
  }
  vault.guardarConcepto(
    crearConcepto({
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion,
      relaciones: c.relaciones
    })
  )
  creados += 1
}

// --- Asignatura de prueba que USA los conceptos (puente tema ↔ concepto) ---
function tema(id: string, titulo: string, orden: number, semana: number, conceptoIds: string[]): Tema {
  let t = crearTema({ id, titulo, orden, semana })
  for (const cid of conceptoIds) t = vincularConcepto(t, cid)
  return t
}
function unidad(id: string, titulo: string, orden: number, temas: Tema[]): Unidad {
  return temas.reduce((u, t) => agregarTema(u, t), crearUnidad({ id, titulo, orden }))
}

let asignaturaCreada = false
if (!vault.existeAsignatura('prueba-algoritmos')) {
  vault.guardarAsignatura(
    crearAsignatura({
      id: 'prueba-algoritmos',
      nombre: 'Prueba · Algoritmos',
      periodos: ['2026A'],
      componentes: [
        crearComponente({ clave: 'CD', nombre: 'Contacto docente' }),
        crearComponente({ clave: 'AA', nombre: 'Aprendizaje autónomo' })
      ],
      unidades: [
        unidad('prueba-u1', 'Fundamentos', 1, [
          tema('prueba-t1', 'Bases de la programación', 1, 1, ['variables', 'funciones']),
          tema('prueba-t2', 'Recursión y algoritmos', 2, 2, [
            'recursividad',
            'divide-y-venceras',
            'ordenamiento'
          ])
        ])
      ]
    })
  )
  asignaturaCreada = true
} else {
  console.log('  · La asignatura "Prueba · Algoritmos" ya existe, se conserva.')
}

console.log(`\n[Prueba] Vault: ${rutaVault}`)
console.log(`[Prueba] ${creados} conceptos creados (de ${conceptos.length}); 6 conexiones entre ellos.`)
console.log(
  `[Prueba] Asignatura de prueba: ${asignaturaCreada ? 'creada' : 'ya existía'} (1 unidad, 2 temas, enlaza los 5 conceptos).`
)
console.log('[Prueba] Mapa (Docencia → Mapa) para el grafo; ficha de un concepto para ver "Se usa en…".')
