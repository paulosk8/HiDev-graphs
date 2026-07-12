/**
 * Siembra datos de demostración en el vault (Documentos/PedagoGraph) para ver el
 * diseño y la interconexión de los conceptos en el grafo.
 *
 * Es aditivo y no destructivo: los conceptos solo se crean si no existen, y la
 * asignatura de ejemplo usa un id propio ('demo-...'). Ejecutar con:
 *   npm run sembrar-demo
 */
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFileSync, rmSync } from 'node:fs'

import { VaultFileSystemService } from '../src/main/infrastructure/VaultFileSystemService'
import { crearConcepto, agregarRecurso } from '../src/main/domain/Concepto'
import { crearRecurso } from '../src/main/domain/Recurso'
import { crearComponente, crearAsignatura } from '../src/main/domain/Asignatura'
import { crearUnidad, agregarTema, type Unidad } from '../src/main/domain/Unidad'
import { crearTema, vincularConcepto, type Tema } from '../src/main/domain/Tema'

const rutaVault = join(homedir(), 'Documents', 'PedagoGraph')
const vault = new VaultFileSystemService(rutaVault)
vault.asegurarVault()

// --- Conceptos (solo si no existen, para no pisar los tuyos) ---
const conceptos: Array<{ id: string; nombre: string; descripcion?: string }> = [
  { id: 'variables', nombre: 'Variables' },
  { id: 'listas', nombre: 'Listas y arreglos' },
  { id: 'recursividad', nombre: 'Recursividad', descripcion: 'Definir algo en términos de sí mismo.' },
  { id: 'funciones', nombre: 'Funciones' },
  { id: 'arboles', nombre: 'Árboles' },
  { id: 'ordenamiento', nombre: 'Ordenamiento' }
]

for (const c of conceptos) {
  if (vault.existeConcepto(c.id)) continue
  let concepto = crearConcepto({ id: c.id, nombre: c.nombre, descripcion: c.descripcion })
  // Un material de ejemplo (Markdown) solo en "Recursividad".
  if (c.id === 'recursividad') {
    const tmp = join(tmpdir(), 'apuntes-recursividad.md')
    writeFileSync(tmp, '# Recursividad\n\n- Caso base\n- Caso recursivo\n\nEjemplo: **factorial** y **Fibonacci**.')
    const { archivo, formato } = vault.copiarRecurso(c.id, tmp)
    concepto = agregarRecurso(concepto, crearRecurso({ id: 'demo-r1', nombre: 'Apuntes de recursividad', archivo, formato }))
    rmSync(tmp, { force: true })
  }
  vault.guardarConcepto(concepto)
}

// --- Asignatura de ejemplo (multi-período) que interconecta los conceptos ---
function tema(id: string, titulo: string, orden: number, semana: number, conceptoIds: string[]): Tema {
  let t = crearTema({ id, titulo, orden, semana })
  for (const cid of conceptoIds) t = vincularConcepto(t, cid)
  return t
}
function unidad(id: string, titulo: string, orden: number, temas: Tema[]): Unidad {
  return temas.reduce((u, t) => agregarTema(u, t), crearUnidad({ id, titulo, orden }))
}

const asignatura = crearAsignatura({
  id: 'demo-estructuras-de-datos',
  nombre: 'Demo · Estructuras de Datos',
  periodos: ['2026A', '2026B'],
  componentes: [
    crearComponente({ clave: 'CD', nombre: 'Contacto docente' }),
    crearComponente({ clave: 'APE', nombre: 'Aprendizaje práctico experimental' }),
    crearComponente({ clave: 'AA', nombre: 'Aprendizaje autónomo' })
  ],
  unidades: [
    unidad('demo-u1', 'Fundamentos', 1, [
      tema('demo-t1', 'Listas y arreglos', 1, 1, ['variables', 'listas']),
      tema('demo-t2', 'Recursión', 2, 2, ['recursividad', 'funciones'])
    ]),
    unidad('demo-u2', 'Estructuras no lineales', 2, [
      tema('demo-t3', 'Árboles', 1, 3, ['recursividad', 'arboles']),
      tema('demo-t4', 'Ordenamiento', 2, 4, ['ordenamiento', 'listas'])
    ])
  ]
})
vault.guardarAsignatura(asignatura)

console.log(`✅ Datos de demostración sembrados en ${rutaVault}`)
console.log('   Abre la app (npm run dev) y entra en "Mapa de conceptos".')
