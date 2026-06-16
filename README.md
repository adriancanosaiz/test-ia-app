# TestForge

Plataforma open source, self-hosted y local-first para gestionar temarios, chatear con ellos mediante RAG y generar tests configurables con IA.

> **Estado:** MVP en desarrollo.
> **Filosofía:** 100% local. No requiere API keys externas.

## Características del MVP

- Organización del temario en **carpetas > asignaturas > documentos**.
- Subida de documentos **PDF, TXT y Markdown** con procesamiento automático en segundo plano.
- Extracción de texto, división en chunks y generación de **embeddings** con pgvector.
- **Chat RAG** global o filtrado por documento, con fuentes, anti prompt-injection y respuestas que continúan generándose aunque navegues por la app.
- **Generador de tests** configurables:
  - número de preguntas,
  - dificultad,
  - tipo de pregunta (test, verdadero/falso, respuesta corta),
  - ámbito de origen.
- Generación de tests y resúmenes en **segundo plano con barra de progreso en tiempo real**.
- Guardado de intentos, nota, respuestas correctas y explicaciones.
- Edición del título de los documentos y elección de color para cada carpeta.
- **IA 100% local** con Ollama.

## Stack

- **Next.js** App Router + TypeScript
- **Tailwind CSS** + shadcn/ui
- **PostgreSQL** + **pgvector**
- **Prisma**
- **Docker Compose**
- **Ollama** para embeddings y chat local

## Modelos locales utilizados

| Propósito | Modelo |
|-----------|--------|
| Embeddings | `nomic-embed-text` (768 dimensiones) |
| Chat / generación de tests | `llama3.2:3b` |

## Requisitos

- Node.js 20+
- npm
- Docker y Docker Compose
- Ollama instalado localmente

## Instalación rápida

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/testforge.git
cd testforge
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

El archivo `.env.example` ya está configurado para Ollama local y PostgreSQL en Docker.

### 4. Descargar modelos de Ollama

```bash
ollama pull nomic-embed-text
ollama pull llama3.2:3b
```

O usa el script incluido:

```bash
./scripts/setup-ollama.sh
```

### 5. Levantar todo de una vez

Asegúrate de tener Ollama corriendo (`ollama serve`) y los modelos descargados. Luego ejecuta:

```bash
npm run dev:start
```

Este script:
1. Levanta PostgreSQL + pgvector con Docker Compose.
2. Verifica que Ollama responde y que tienes los modelos necesarios.
3. Aplica migraciones de Prisma.
4. Inicia el servidor de desarrollo en [http://localhost:3000](http://localhost:3000).

### 6. Parar los servicios

```bash
npm run dev:stop
```

Esto para solo PostgreSQL. Ollama sigue corriendo si lo tenías abierto.

> **Nota para macOS:** Docker Desktop no expone GPU fácilmente. Ollama debe estar instalado **nativamente** en tu Mac. El contenedor de PostgreSQL se expone en `localhost:5433` para evitar conflictos con un PostgreSQL local.

## Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run build` | Compila para producción |
| `npm run lint` | Ejecuta ESLint |
| `npx tsc --noEmit` | Verifica tipos de TypeScript |
| `npm run test` | Ejecuta la suite de tests |
| `npm run test:watch` | Ejecuta tests en modo watch |
| `npm run test:coverage` | Ejecuta tests con cobertura |
| `npm run dev:start` | Levanta Docker, verifica Ollama, migra e inicia la app |
| `npm run dev:stop` | Para el contenedor de PostgreSQL |
| `npm run db:migrate` | Aplica migraciones de Prisma |
| `npm run db:seed` | Inserta datos de ejemplo |
| `npm run db:studio` | Abre Prisma Studio |
| `npm run db:generate` | Genera el cliente de Prisma |

## Accesibilidad

La interfaz sigue las pautas **WCAG 2.2 AA**:

- Navegación completa con teclado (Tab, Shift+Tab, Enter, Escape, Space).
- Landmarks semánticos (`<header>`, `<nav>`, `<main>`, `<footer>`), skip link y migas de pan.
- Todos los formularios tienen labels visibles, errores asociados con `aria-describedby` y campos obligatorios indicados.
- Listados con estructura de listas (`<ul>`/`<li>`) y jerarquía de headings coherente.
- Chat con region `role="log"` y `aria-live` para anunciar nuevos mensajes; las respuestas en curso se anuncian mediante su estado `PROCESSING`.
- Tests con agrupación `fieldset/legend` y barra de progreso semántica; la generación de tests muestra progreso en tiempo real.
- Toasts accesibles con `role="status"`/`role="alert"` y `aria-live`.
- Toggle de tema claro/oscuro con persistencia en cookie y respeto a `prefers-reduced-motion`.

Los tests de componentes con **axe-core** se ejecutan junto a la suite habitual:

```bash
npm run test
```

## Tests

La suite usa **Vitest**. Los tests unitarios no requieren base de datos; los tests de integración usan PostgreSQL.

### Preparar la base de datos de test

El archivo `.env.test` apunta por defecto a `testforge_test` en el mismo servidor PostgreSQL de desarrollo (`localhost:5433`). Crea la base de datos antes de ejecutar tests:

```bash
psql postgresql://testforge:testforge@localhost:5433/testforge -c "CREATE DATABASE testforge_test;"
DATABASE_URL="postgresql://testforge:testforge@localhost:5433/testforge_test" npx prisma migrate deploy
```

### Ejecutar tests

```bash
npm run test
```

### Estructura de la suite

- `src/modules/<feature>/job.test.ts` — jobs en segundo plano.
- `src/modules/<feature>/*.test.ts` — parsing, chunking y almacenamiento.
- `src/modules/ai/*.test.ts` — proveedores de IA, RAG y generador de tests (mockeados).
- `src/modules/<feature>/actions.test.ts` — Server Actions de dominio con base de datos real.
- `src/app/api/<recurso>/[id]/progress/route.test.ts` — endpoints SSE de progreso.

### CI

El workflow `.github/workflows/ci.yml` ejecuta lint, type-check, tests y build en cada push y pull request.

## Flujo de tests

Una vez tienes documentos indexados, puedes generar tests desde `/tests`:

1. Pulsa **Nuevo test** y selecciona:
   - Ámbito: carpeta, asignatura o documento concreto.
   - Tipo de pregunta: opción múltiple, verdadero/falso o respuesta corta.
   - Dificultad y número de preguntas.
2. El test se crea inmediatamente y la IA genera las preguntas en segundo plano. Verás una barra de progreso en tiempo real.
3. Cuando el test esté listo, pulsa **Hacer test** para responder.
4. Al finalizar se calcula la nota automáticamente:
   - Opción múltiple y verdadero/falso se corrigen solas.
   - Las respuestas cortas se guardan para corrección manual.
5. Desde **Ver intentos** puedes revisar cada intento, comparar tus respuestas con las correctas y leer las explicaciones.

## Configuración de IA

El MVP funciona únicamente con Ollama. La configuración por defecto es:

```bash
EMBEDDING_PROVIDER=ollama
CHAT_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_CHAT_MODEL=llama3.2:3b
```

> **Nota para futuras integraciones:** el código mantiene interfaces internas (`EmbeddingProvider`, `ChatProvider`) para facilitar la adición de otros proveedores más adelante, pero en el MVP solo existe implementación real de Ollama.

## Arquitectura

```text
src/
├── app/              # Rutas y Server Actions de Next.js
├── components/ui/    # Componentes de shadcn/ui
├── modules/          # Dominio por feature
│   ├── ai/           # Proveedores de IA, RAG y generación de tests
│   ├── documents/    # Subida, parsing, chunking y almacenamiento
│   ├── folders/      # Gestión de carpetas
│   ├── subjects/     # Gestión de asignaturas
│   ├── summaries/    # Resúmenes generados
│   ├── tests/        # Tests e intentos
│   ├── chat/         # Sesiones y mensajes
│   └── <feature>/    # queries.ts, mutations.ts, schemas.ts, types.ts, job.ts
└── lib/              # Utilidades, Prisma, constantes, jobs y SSE
```

## Seguridad

- Los archivos subidos se almacenan con un `storageKey` UUID fuera de la raíz web.
- Los contenidos generados por IA se renderizan con sanitización de HTML.
- El prompt de sistema trata los chunks recuperados como datos de referencia, ignorando cualquier instrucción que contengan.
- La autenticación multiusuario está fuera del MVP; puedes activar una contraseña maestra con `LOCK_PASSWORD`.

## Contribuir

1. Haz fork del repositorio.
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`.
3. Realiza tus cambios y añade tests si aplica.
4. Abre un Pull Request.

## Licencia

Este proyecto está licenciado bajo la [Licencia MIT](LICENSE).
