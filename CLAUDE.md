# PedagoGraph

Aplicación de escritorio (Electron) para **docentes universitarios sin conocimientos técnicos**. Permite organizar material pedagógico por **conceptos reutilizables** entre asignaturas y visualizar sus relaciones como un grafo.

> Este archivo es la fuente de contexto para futuras sesiones. Léelo completo antes de trabajar.

---

## 1. Visión

El docente reutiliza el mismo material entre asignaturas y períodos. Hoy lo hace copiando carpetas y perdiendo el hilo de "dónde usé esto". PedagoGraph separa **lo que se enseña** (conceptos, estables, transversales) de **dónde/cuándo se enseña** (asignaturas de un período concreto), y conecta ambas capas. El material vive junto al concepto, no junto a la asignatura, así que planificar una asignatura nueva es en gran parte **reconectar** conceptos existentes.

El usuario objetivo **no es técnico**. Nunca ve archivos, YAML, rutas, ni jerga de software. Todo es formularios, buscadores con autocompletado y arrastrar-y-soltar.

---

## 2. Modelo de dominio (dos capas + puente)

### Capa de conocimiento (transversal, estable)
- **Concepto**: unidad de conocimiento reutilizable (ej. "Divide y vencerás").
  - Tiene **relaciones tipadas** con otros conceptos: `prerequisito_de`, `relacionado_con`, `profundiza`.
  - Posee **Recursos** (el material). Los recursos pertenecen **al concepto, jamás a una asignatura**.
- **Recurso**: archivo de material. Formatos: `pptx, pdf, md, html, docx, xml`. Se clasifica por extensión.

### Capa curricular (por período académico)
- **Asignatura** (ej. "Algoritmos 2026A") → contiene **Unidades**.
- **Unidad** → contiene **Temas**.
- **Tema** → puede contener **Subtemas**.
- Planificación por **Semana**.
- **Componentes de aprendizaje** configurables **por asignatura**. Ejemplos institucionales:
  - `CD` = contacto docente
  - `CP` = componente práctico
  - `APE` = aprendizaje práctico experimental
  - `AA` = aprendizaje autónomo
  - (la lista es configurable por asignatura; no está fija en el código)

### Puente entre capas
- Un **Tema instancia uno o más Conceptos**. Esa vinculación (Tema ↔ Concepto) es lo que permite que el mismo material se reutilice entre asignaturas.
- Desde la ficha de un concepto se puede responder: **"¿en qué asignaturas / unidades / temas se usa este concepto?"**.

---

## 3. Persistencia

### Fuente de verdad: el sistema de archivos (vault YAML)
La app crea automáticamente, **sin preguntar nada**, un "vault" en la carpeta Documentos del usuario:

```
Documentos/PedagoGraph/
  conceptos/
    <slug>/
      concepto.yaml         # metadatos + relaciones + lista de recursos
      <archivos de recurso>  # el material copiado (pdf, pptx, ...)
  asignaturas/
    <slug>/
      pea.yaml              # plan de estudios de la asignatura (unidades/temas/semanas/componentes/vínculos a conceptos)
  .index/
    index.db               # índice SQLite (derivado, reconstruible)
```

- El **usuario nunca ve ni edita YAML**. Toda entrada de datos es por formularios y drag & drop. **La app escribe los YAML.**
- `slug` es un detalle interno (nombre de carpeta seguro). Nunca se muestra al usuario.

### Índice: SQLite (better-sqlite3)
- Vive en `vault/.index/index.db`, en el **main process**.
- Es **siempre reconstruible** escaneando el vault → comando **"Reindexar"**.
- Sincronización **unidireccional**: `filesystem (YAML) → índice (SQLite)`. Nunca al revés. Los YAML mandan.
- Se mantiene vivo observando el vault con **chokidar**.
- Tablas mínimas:
  - `nodes` — conceptos, asignaturas, unidades, temas, subtemas (tipo discriminador).
  - `edges` — relaciones, con columna `tipo_relacion` (concepto↔concepto tipadas; y tema→concepto como vínculo; y jerarquía curricular).
  - `resources` — material por concepto (ruta, formato, nombre visible).

Si `index.db` se borra manualmente, **Reindexar lo reconstruye desde los YAML sin pérdida** (criterio de aceptación).

---

## 4. Stack (fijo — no agregar dependencias sin justificación explícita)

- **electron-vite** + Electron + React 18 + TypeScript **estricto**.
- **better-sqlite3** (solo en main process), **chokidar**, **js-yaml**.
- **Cytoscape.js** con layout **fcose** para el grafo (Fase 2).
- **Zustand** para el estado del renderer.
- **UI**: Tailwind + componentes propios simples.
- **Idioma de toda la UI: ESPAÑOL.**

---

## 5. Arquitectura (el main process es un backend)

```
src/
  main/
    domain/          # entidades y lógica PURA. Sin Electron, sin SQLite, sin fs.
                     #   Concepto, Asignatura, Unidad, Tema, Subtema, Recurso, Relacion
                     #   IGraphRepository (interfaz), tipos de valor, slugify, validaciones
    infrastructure/  # implementaciones concretas
                     #   SqliteGraphRepository (implementa IGraphRepository)
                     #   VaultFileSystemService (crea vault, lee/escribe YAML, copia recursos)
                     #   IndexSyncService (observer de chokidar: fs -> índice)
    application/     # casos de uso, orquestan dominio + infraestructura
                     #   CrearConcepto, AgregarRecurso, VincularTemaConcepto,
                     #   CrearAsignatura, ReindexarVault, RespaldarVault, ...
    ipc/             # registro de handlers IPC (mapea canales -> casos de uso)
  shared/            # contrato IPC TIPADO: canales + DTOs. Compartido main <-> renderer.
  preload/           # bridge contextIsolation: expone api tipada al renderer
  renderer/          # React. SOLO llama IPC. CERO lógica de negocio.
    ui/ (componentes), stores/ (zustand), pages/, features/
```

### Reglas de arquitectura
- El **renderer solo llama IPC**. Cero acceso a fs/SQLite/dominio desde el renderer.
- `src/shared` define el contrato: nombres de canal y DTOs. Ambos lados importan de aquí.
- Dependencias apuntan hacia el dominio: `application` depende de `domain`; `infrastructure` implementa interfaces de `domain`. `domain` no depende de nadie.

### SOLID pragmático
- Interfaces **solo donde hay variabilidad real**:
  - `IGraphRepository` (repositorio del grafo).
  - Fase 3: parsers **Strategy** por formato institucional de PEA.
- **NO** crear abstracciones especulativas. **NO** event sourcing. **NO** sobre-ingeniería.

---

## 6. Principios UX (críticos — el usuario es un docente no técnico)

- **Cero configuración**: funciona al primer arranque. Sin pantallas de settings en el MVP.
- **Lenguaje pedagógico, nunca técnico**: "Mis asignaturas", "Conceptos", "Material", "Semana".
  Prohibido en la UI: "nodo", "slug", "índice", "YAML", "vault", "repositorio", "base de datos".
- **Crear cualquier cosa = 2-3 campos + botón guardar.** Lo compuesto (crear asignatura) usa **wizard paso a paso** (unidades → temas → semanas con componentes).
- **Agregar material = arrastrar archivos** sobre la ficha del concepto (o botón "Agregar material" con selector nativo). La app **copia** el archivo al vault y lo clasifica por extensión.
- **Vincular tema ↔ concepto**: buscador con **autocompletado** y opción **"crear concepto nuevo" inline** si no existe.
- **Errores en lenguaje humano** con acción sugerida. **Confirmación antes de eliminar.** Nada falla en silencio.
- **Diseño limpio tipo Notion/Linear**: sidebar izquierda (Asignaturas / Conceptos), área central de contenido, tipografía legible, espaciado generoso.

---

## 7. Fases

### Fase 1 (MVP) — la única a implementar por ahora
- Scaffold electron-vite.
- Creación automática del vault.
- CRUD de **conceptos** con formularios.
- Agregar **material** por drag & drop (copia al vault, clasifica por extensión).
- CRUD de **asignaturas** con **wizard** (unidades → temas → semanas con componentes).
- **Vincular temas a conceptos** con autocompletado (+ crear concepto inline).
- **Ficha de concepto**: muestra su material y en qué asignaturas/temas se usa.
- **Índice SQLite** + botón **Reindexar**.
- Botón de **respaldo** (zip del vault).

### Fase 2
- Vista de **grafo Cytoscape** (layout fcose) con filtros (por asignatura, por tipo de relación).
- Vista de **planificación semanal** con semáforo de cobertura de material.

### Fase 3
- Generador de **tareas por componente de aprendizaje** basado en el material del concepto, exportable a **Markdown/Moodle**.
- Parsers Strategy por formato institucional de PEA.

---

## 8. Criterios de aceptación de la Fase 1

1. `npm run dev` abre la app y crea el vault en `Documentos/PedagoGraph` si no existe.
2. Puedo crear el concepto "Divide y vencerás", arrastrarle un PDF y verlo listado en su ficha.
3. Puedo crear la asignatura "Algoritmos 2026A" con 1 unidad, 2 temas y componentes CD/APE/AA, en menos de 2 minutos y sin leer documentación.
4. Puedo vincular el tema 1 al concepto y la ficha del concepto muestra "Se usa en: Algoritmos 2026A › Unidad 1 › Tema 1".
5. Si borro `index.db` manualmente, "Reindexar" lo reconstruye desde los YAML sin pérdida.
6. Toda la UI está en español y sin términos técnicos.

---

## 9. Convenciones de código

- TypeScript estricto (`strict: true`). Nada de `any` implícito.
- Nombres de dominio en **español** (Concepto, Asignatura, Tema, Recurso, Relacion) para alinear código y lenguaje del usuario.
- Casos de uso: un archivo por caso, verbo + sustantivo (`CrearConcepto.ts`).
- El contrato IPC es la única superficie entre renderer y main; cambiarlo obliga a tocar `src/shared`.
- Sincronización siempre `fs → índice`. Si dudas, los YAML son la verdad.

---

## 10. Flujo de trabajo Git

Repositorio: `https://github.com/paulosk8/HiDev-graphs`

### Commits semánticos (Conventional Commits)
Formato: `<tipo>(<ámbito opcional>): <descripción en imperativo>`

Tipos usados:
- `feat` — nueva funcionalidad para el usuario.
- `fix` — corrección de un error.
- `docs` — documentación (CLAUDE.md, README...).
- `chore` — tooling, configuración, dependencias (scaffold, tsconfig...).
- `refactor` — cambio interno sin alterar comportamiento.
- `style` — formato, sin cambios de lógica.
- `test` — añadir o ajustar pruebas.

Ejemplos: `feat(conceptos): crear concepto con formulario`, `chore: scaffold electron-vite`, `docs: especificación del proyecto`.

Ámbitos frecuentes: `conceptos`, `asignaturas`, `vault`, `indice`, `material`, `vinculos`, `ipc`, `ui`.

### Estrategia de ramas (GitHub Flow)
- `main` siempre desplegable.
- Una rama por unidad de trabajo: `feat/<algo>`, `fix/<algo>`, `chore/<algo>`.
- Se integra a `main` vía Pull Request. `main` no recibe commits directos de features.
- Alineado con los bloques de trabajo de la Fase 1 (una rama por bloque cuando aplique).
