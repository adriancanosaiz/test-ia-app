# Plan de implementación — TestForge MVP 100 % funcional

> Plan detallado derivado de la investigación en paralelo de los 8 módulos principales de la aplicación. El objetivo es convertir TestForge en un MVP completo, estable, accesible y visualmente coherente, sin romper la filosofía local-first/self-hosted.
>
> **Cómo usar este documento:** las tareas se marcan como `[x]` a medida que se completan al 100 %. Si se pierde el contexto del chat, este archivo es la fuente de verdad del estado del trabajo.

---

## 1. Resumen ejecutivo

**Estado actual:** la aplicación compila, pasa tests (147 tests) y tiene una arquitectura sólida (Next.js 16 App Router, Tailwind v4, Prisma, Ollama, jobs en memoria, SSE). Sin embargo, hay problemas críticos que impiden llamarla MVP terminado:

- Bugs de diseño que rompen la tipografía y la coherencia visual.
- Diálogos destructivos inaccesibles (`confirm()` nativo en 7 lugares).
- Errores crudos lanzados desde Server Actions en lugar de `ActionResult`.
- Funcionalidades incompletas: chat sin fuentes, respuestas cortas sin corrección, documentos procesándose de forma síncrona.
- Backend frágil: sin reintentos a Ollama, sin timeout, jobs en memoria sin persistencia.
- Baja cobertura de tests en UI y páginas.

**Estrategia recomendada:** abordar el trabajo en 4 fases iterativas. Cada fase es independiente, testeable y debe dejar el pipeline CI verde (`tsc`, `lint`, `test`, `build`). No se añaden features nuevas hasta que la fase anterior esté estable.

---

## 2. Fase 1 — Cimientos: diseño, accesibilidad y gestión de errores

**Objetivo:** dejar la aplicación visualmente coherente, accesible y con manejo de errores robusto antes de tocar flujos de negocio.

### 2.1 Tokens y sistema de diseño

**Archivos:** `src/app/globals.css`, `src/components/ui/*.tsx`

- [x] Corregir `--font-sans: var(--font-geist-sans)` y `--font-heading: var(--font-geist-sans)` en `globals.css`.
- [x] Añadir `--destructive-foreground` y tokens semánticos: `--success`, `--success-foreground`, `--warning`, `--warning-foreground`, `--info`, `--info-foreground`.
- [x] Diferenciar `secondary`, `muted` y `accent` en modo claro.
- [x] Oscurecer `--muted-foreground` y `--ring` para cumplir WCAG 2.2 AA.
- [x] Aplicar tokens semánticos en `badge.tsx`, `toast.tsx`, `form-error.tsx` y estados de documentos/tests.

### 2.2 Componentes UI base faltantes

**Nuevos archivos:**

- [x] `src/components/ui/empty-state.tsx`: icono, título, descripción y CTA; `role="status"`.
- [x] `src/components/ui/confirm-dialog.tsx`: diálogo destructivo accesible con `DialogTitle` y `DialogDescription`.
- [x] `src/components/ui/status-badge.tsx`: wrapper semántico sobre `Badge` para estados de documentos/tests/jobs.
- [x] `src/components/ui/spinner.tsx`: indicador de carga reutilizable para botones.
- [x] `src/components/ui/tooltip.tsx` y `src/components/ui/dropdown-menu.tsx`: menús de acciones en listados.

**Modificaciones:**

- [x] `select.tsx`: cambiar `w-fit` a `w-full`, ocultar iconos decorativos con `aria-hidden`, añadir `aria-label` a scroll buttons.
- [x] `select-field.tsx`: añadir `htmlFor` al `Label` para que sea clickeable.
- [x] `dialog.tsx`: traducir "Close" a "Cerrar".
- [x] `toaster.tsx`: añadir `aria-live="polite"` a la región de toasts.
- [x] `form-error.tsx`: usar tokens `text-destructive` / `bg-destructive` en lugar de `text-red-600`.
- [x] `badge.tsx`: corregir variant destructive; añadir `success`, `warning`, `info`.

### 2.3 Navegación y layout

**Archivos:** `src/app/layout.tsx`, `src/components/nav-link.tsx`, `src/components/mobile-nav.tsx`, `src/components/footer.tsx`, `src/components/breadcrumb.tsx`, `src/app/page.tsx`, `src/app/dashboard/page.tsx`

- [x] Hacer el logo contextual: `/` en landing, `/dashboard` en el resto.
- [x] Añadir `DialogDescription` al menú móvil.
- [x] Convertir el grid de features de la homepage a `<ul>/<li>` con `CardTitle as="h3"`.
- [x] Añadir `aria-hidden="true"` al punto verde del badge de la landing.
- [x] Corregir enlace circular de "Documentos" en el dashboard (`href="/dashboard"` → deshabilitar o crear `/documents`).
- [x] Hacer las tarjetas de estadísticas semánticamente clickeables (enlace invisible o CTA en título).
- [x] Añadir breadcrumbs en `/folders/[id]`, `/subjects/[id]`, `/tests/[id]` y `/tests/[id]/attempts/[attemptId]`.
- [x] Añadir tests de accesibilidad para `nav-link`, `mobile-nav`, `footer`, `breadcrumb`, `theme-toggle`.

### 2.4 Gestión de errores en Server Actions

**Archivos:** `src/lib/action-utils.ts`, `src/lib/errors.ts`, `src/modules/documents/mutations.ts`, `src/modules/chat/mutations.ts`, `src/modules/tests/mutations.ts`, `src/modules/folders/mutations.ts`, `src/modules/subjects/mutations.ts`, `src/modules/summaries/mutations.ts`

- [x] Envolver `uploadDocument`, `processDocument`, `createChatSession`, `createTest`, `createAttempt`, `createFolder`, `createSubject` en `action()` y `parseFormData()`.
- [x] Devolver siempre `ActionResult<T>`; nunca lanzar errores crudos al cliente.
- [x] Mapear errores de Zod a `fieldErrors` en los formularios.
- [x] Sanitizar mensajes de Prisma/Ollama: mensajes amigables para `USER_ERROR`, logs internos para `SYSTEM_ERROR`.
- [x] Añadir/actualizar tests de acciones para casos de error.

### 2.5 Páginas SSR y error boundaries

**Archivos:** `src/app/dashboard/page.tsx`, `src/app/folders/[id]/page.tsx`, `src/app/subjects/[id]/page.tsx`, `src/app/tests/page.tsx`, `src/app/tests/[id]/page.tsx`, `src/app/chat/page.tsx`, `src/app/chat/[id]/page.tsx`, `src/app/error.tsx`, `src/app/loading.tsx`

- [x] Añadir `try/catch` en queries de páginas para devolver estados de error manejables (mensaje + botón de reintentar).
- [x] Añadir `loading.tsx` en rutas principales con `Skeleton`.
- [x] Mejorar `error.tsx` para distinguir errores recuperables.

### 2.6 Reemplazar `confirm()` nativo

**Archivos afectados:**

- [x] `src/modules/folders/components/folder-list.tsx`
- [x] `src/modules/subjects/components/subject-list.tsx`
- [x] `src/modules/tests/components/test-list.tsx`
- [x] `src/modules/documents/components/document-list.tsx`
- [x] `src/modules/chat/components/chat-session-list.tsx`
- [x] `src/modules/summaries/components/summary-list.tsx`
- [x] `src/modules/tests/components/attempt-form.tsx`

- [x] Usar `<ConfirmDialog>` reutilizable en todas las eliminaciones y en el envío de intento con preguntas sin responder.
- [x] Añadir tests de accesibilidad para cada diálogo.

### 2.7 Criterios de éxito de la Fase 1

- [x] `npx tsc --noEmit && npm run lint && npm run test && npm run build` verde.
- [x] Todos los `confirm()` nativos eliminados.
- [x] Todos los componentes de navegación testeados con `expectNoViolations`.
- [x] Server Actions críticas devolviendo `ActionResult`.
- [x] Tokens de color y tipografía aplicados correctamente.

---

## 3. Fase 2 — Flujos principales: documentos, chat y tests

**Objetivo:** completar las funcionalidades centrales del MVP que hoy están rotas o incompletas.

### 3.1 Procesamiento de documentos 100 % asíncrono

**Archivos:** `src/modules/documents/mutations.ts`, `src/modules/documents/job.ts`, `src/modules/documents/components/document-upload.tsx`, `src/modules/documents/components/document-list.tsx`, `src/app/api/documents/[id]/progress/route.ts`

- [x] Cambiar `processDocument` para que solo actualice el estado a `PROCESSING` y encole el job (`enqueueJob`); no llamar sincrónicamente a `processDocumentJob`.
- [x] Validar tamaño y tipo de archivo en cliente antes del submit.
- [x] Mostrar barra de progreso real de subida si es posible, o al menos estado "Subiendo…" con `Spinner`.
- [x] Normalizar SSE para usar `event: progress` y escuchar con `addEventListener("progress")`.
- [x] Añadir reconexión automática del SSE con backoff.
- [x] Añadir botón "Cancelar" durante el procesamiento.
- [x] Añadir tests de flujo completo: subida → progreso → ready → error → reintentar.

### 3.2 Chat RAG completo

**Archivos:** `src/modules/chat/components/chat.tsx`, `src/modules/chat/components/chat-session-list.tsx`, `src/modules/chat/components/new-chat-dialog.tsx`, `src/modules/chat/mutations.ts`, `src/modules/chat/job.ts`, `src/modules/ai/rag.ts`, `src/app/api/chat/[id]/progress/route.ts`

- [x] Renderizar fuentes al final de cada respuesta del asistente (documento, asignatura, similitud, página si aplica).
- [x] Pedir citas inline `[1]`, `[2]` en el `SYSTEM_PROMPT` y parsearlas para enlazar con fuentes.
- [x] Cambiar el input a `<Textarea>` auto-ajustable.
- [x] Añadir botón de cancelar generación.
- [x] Añadir acciones por mensaje: copiar, regenerar.
- [x] Eliminar indicador de carga duplicado (skeleton + burbuja PROCESSING).
- [x] Asociar el SSE al mensaje concreto (`assistantMessageId`), no al último mensaje del asistente.
- [x] Mostrar error amigable y botón de reintentar si falla Ollama.
- [x] Mejorar layout móvil (altura dinámica, sidebar colapsable).
- [x] Añadir empty states con CTA y sugerencias de preguntas.
- [x] Añadir tests de componentes y flujo SSE.

### 3.3 Tests e intentos completos

**Archivos:** `src/modules/tests/components/test-form.tsx`, `src/modules/tests/components/attempt-form.tsx`, `src/modules/tests/components/attempt-detail.tsx`, `src/modules/tests/mutations.ts`, `src/modules/tests/scoring.ts`, `src/app/api/tests/[id]/progress/route.ts`

- [x] Refactorizar `createTest` y `createAttempt` a `ActionResult` + mapeo de errores por campo.
- [x] Implementar corrección de respuestas cortas (`SHORT_ANSWER`):
  - Opción A: corrección manual en el detalle del intento (botón correcta/incorrecta).
  - Opción B: corrección semántica con IA (similitud con `modelAnswer`).
  - Recomendación: empezar con opción A (más determinista para MVP).
- [x] Mostrar nota sobre total de preguntas y sobre preguntas autoevaluables.
- [x] Añadir persistencia de borrador en `localStorage` durante el intento.
- [x] Añadir temporizador opcional.
- [x] Reemplazar `<progress>` nativo por componente `<Progress>`.
- [x] Corregir numeración de intentos (#1 = primer intento).
- [x] Añadir botón "Repetir test" en el detalle del intento.
- [x] Mostrar estado del test en el listado (`PROCESSING`, `READY`, `ERROR`).
- [x] Añadir tests de flujo completo de test e intento.

### 3.4 Resúmenes

**Archivos:** `src/modules/summaries/components/summary-list.tsx`, `src/modules/summaries/components/summary-detail.tsx`, `src/app/documents/[id]/summaries/page.tsx`, `src/modules/summaries/mutations.ts`

- [x] Añadir botón "Generar resumen" en `/documents/[id]/summaries`.
- [x] Renderizar markdown sanitizado en el detalle.
- [x] Añadir SSE en el detalle para progreso en tiempo real.
- [x] Mostrar mensaje de error real y botón de reintento.
- [x] Mejorar empty state con CTA directo.

### 3.5 Criterios de éxito de la Fase 2

- [x] Subida y procesamiento de documentos totalmente asíncrono.
- [x] Chat muestra fuentes y permite cancelar/regenerar.
- [x] Tests con respuestas cortas corregibles y nota completa.
- [x] Todos los flujos tienen tests de integración.
- [x] Pipeline CI verde.

---

## 4. Fase 3 — Descubrimiento, onboarding y dashboard

**Objetivo:** hacer la aplicación usable y agradable cuando crezca el contenido.

### 4.1 Dashboard y onboarding

**Archivos:** `src/app/dashboard/page.tsx`, `src/modules/folders/components/folder-list.tsx`

- [x] Añadir widget de onboarding paso a paso cuando no haya carpetas.
- [x] Mostrar actividad reciente: últimos documentos, tests en progreso, chats recientes.
- [x] Añadir tarjetas de resumen con tendencias (documentos listos, tests creados, nota media).
- [x] Añadir tests del dashboard vacío y con contenido.

### 4.2 Búsqueda y filtros

**Nuevos archivos:**

- [x] `src/components/global-search.tsx`: paleta de comandos (`Cmd+K`) para navegar entre carpetas, asignaturas, documentos, tests y chats.
- [x] `src/components/ui/tabs.tsx`: navegación por pestañas.

**Modificaciones:**

- [x] Añadir búsqueda por título en listados de carpetas, asignaturas, documentos, tests e intentos.
- [x] Añadir filtros por estado en documentos, tests e intentos.
- [x] Añadir ordenamiento por nombre/fecha.

### 4.3 Empty states y microinteracciones

- [x] Reemplazar todos los empty states manuales por `<EmptyState>`.
- [x] Añadir animaciones sutiles (hover, entrada de tarjetas) respetando `prefers-reduced-motion`.
- [x] Añadir iconografía expresiva en estados vacíos y de éxito.

### 4.4 Criterios de éxito de la Fase 3

- [x] Dashboard con onboarding y actividad reciente.
- [x] Búsqueda global funcional.
- [x] Filtros y ordenamiento en todos los listados.
- [x] Empty states coherentes y accesibles.

---

## 5. Fase 4 — Robustez del backend

**Objetivo:** que la aplicación sea confiable en un entorno local real.

### 5.1 Integración con Ollama resistente

**Archivos:** `src/modules/ai/ollama.ts`, `src/modules/ai/provider.ts`, `src/app/status/page.tsx`

- [x] Añadir reintentos con backoff en llamadas a Ollama (3 intentos para errores de red/5xx).
- [x] Añadir `AbortController` con timeout.
- [x] Validar que los modelos configurados existen antes de usarlos; devolver `USER_ERROR` claro si faltan.
- [x] Hacer configurable la dimensión de embeddings (`OLLAMA_EMBEDDING_DIMENSIONS`).
- [x] Sanitizar JSON devuelto por `completeJSON` (eliminar markdown accidental).
- [x] Ampliar `/status` para verificar modelos requeridos.

### 5.2 Rate limiting y seguridad

**Archivos:** `src/lib/rate-limit.ts`, `src/lib/constants.ts`, `src/modules/documents/actions.ts`, `src/modules/tests/actions.ts`, `src/modules/chat/actions.ts`

- [x] Implementar rate limiting por IP en subida de documentos, generación de tests y chat.
- [x] Añadir validación anti prompt-injection básica en inputs de chat y generación de tests.
- [x] Añadir límite de longitud de mensaje de chat.

### 5.3 Persistencia y cancelación de jobs

**Archivos:** `prisma/schema.prisma`, `src/lib/jobs/runner.ts`, todos los `job.ts`

- [x] Crear modelo `ProcessingJob` en Prisma con estado, progreso, intentos, error.
- [x] Persistir jobs en BD al encolarlos.
- [x] Reanudar jobs pendientes al reiniciar el servidor.
- [x] Permitir cancelar jobs desde la UI y propagar señal de abort.
- [x] Añadir heartbeat en SSE y timeout de conexión.

### 5.4 API route obsoleta y SSE

- [x] Eliminar o deprecar definitivamente `/api/chat/stream`.
- [x] Normalizar todos los endpoints SSE para usar `event: progress`, `event: error` parseable y `event: complete`.

### 5.5 Criterios de éxito de la Fase 4

- [x] Ollama con reintentos y timeout.
- [x] Rate limiting activo.
- [x] Jobs persistentes y cancelables.
- [x] `/api/chat/stream` eliminado.
- [x] Pipeline CI verde.

---

## 6. Dependencias entre fases

```
Fase 1 (cimientos)
  ├─ necesaria para → Fase 2 (componentes base, errores, accesibilidad)
  └─ necesaria para → Fase 3 (empty states, diseño coherente)

Fase 2 (flujos principales)
  └─ necesaria para → Fase 4 (persistencia de jobs, cancelación)

Fase 3 (descubrimiento)
  └─ independiente, puede hacerse en paralelo a Fase 4
```

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Cambios en schema de Prisma requieren migraciones | Crear migraciones con `npx prisma migrate dev` en cada fase que toque schema. |
| Cambios en componentes base rompen tests existentes | Actualizar tests y ejecutar `npm run test` tras cada cambio. |
| Refactor de Server Actions cambia contratos de UI | Hacer migración por feature completa (action + componente + tests) antes de pasar a la siguiente. |
| Ollama no está disponible en CI | Los tests de IA ya están mockeados; mantener mocks para jobs y provider. |
| Scope excesivo | Cada fase se entrega y valida por separado. No se avanza hasta CI verde. |

---

## 8. Criterios de éxito globales del MVP

- [x] `npx tsc --noEmit && npm run lint && npm run test && npm run build` siempre verde.
- [x] Cobertura de tests aumentada significativamente, especialmente en componentes y páginas (de 147 a 350 tests).
- [x] Todos los flujos principales funcionan sin errores crudos: subida, procesamiento, chat con fuentes, generación de tests, intentos, corrección de respuestas cortas.
- [x] Interfaz coherente, accesible (WCAG 2.2 AA) y con empty states/CTAs claros.
- [x] Backend robusto: reintentos, rate limiting, jobs persistentes.

---

## 9. Estimación aproximada

| Fase | Esfuerzo estimado | Entregable clave |
|------|-------------------|------------------|
| Fase 1 | Alto | App estable, accesible y con errores bien gestionados |
| Fase 2 | Muy alto | Funcionalidades principales 100 % operativas |
| Fase 3 | Medio-Alto | App usable con contenido real |
| Fase 4 | Alto | App confiable para uso local continuo |

> Nota: las estimaciones son orientativas. Se reevaluarán tras completar la Fase 1.

---

## 10. Próximo paso inmediato

Una vez aprobado este plan, se comenzará por la **Fase 1** descomponiéndola en tareas paralelas mediante subagentes:

1. [x] Subagente A: tokens, tipografía y componentes UI base.
2. [x] Subagente B: navegación, layout, homepage y dashboard.
3. [x] Subagente C: refactor de Server Actions a `ActionResult` y `action()`.
4. [x] Subagente D: reemplazo de `confirm()` nativo por `<ConfirmDialog>`.
5. [x] Subagente E: páginas SSR, loading states y error boundaries.

Cada subagente ejecutará sus cambios, añadirá/actualizará tests y verificará que el pipeline local pase antes de entregar.

---

## 11. Nueva fase — Selección y configuración de modelos de IA

Fase actual en curso para permitir elegir entre Ollama local y APIs externas (OpenAI, Anthropic, Groq), con configuración persistida en base de datos.

### 11.1 Schema Prisma

- [x] Añadir modelo `AppSettings` en `prisma/schema.prisma`.
- [x] Ejecutar migración `add_app_settings` y regenerar cliente Prisma.

### 11.2 Integración de providers de IA

- [x] Adaptar providers para consumir settings de BD.
- [x] Añadir soporte real para OpenAI, Anthropic y Groq.

### 11.3 Capa de configuración

- [x] Crear `src/lib/settings.ts` con `getSettings`, `saveSettings` y `getEffectiveSettings`.
- [x] Crear tipos (`ChatProvider`, `EmbeddingProvider`) y schema Zod en `src/lib/settings/`.
- [x] Crear barrel `src/lib/settings/actions.ts`.
- [x] Añadir tests en `src/lib/settings/settings.test.ts`.

### 11.4 Descarga e instalación guiada de modelos Ollama

- [x] Catalogar modelos recomendados por hardware en `src/modules/ai/ollama-models.ts`.
- [x] Endpoint `/api/ollama/models` para listar modelos instalados y recomendados.
- [x] Endpoint `/api/ollama/pull` que haga stream del progreso de descarga desde Ollama.
- [x] Componente `ModelSelector` para wizard/setup y settings con progreso en tiempo real.
- [x] Página `/setup` (wizard inicial) y `/settings` (cambio de modelo en administración).
- [x] Tests para endpoints, componente y páginas.
- [x] Integrar con UI y providers de IA.

### 11.5 Providers de IA externos

- [x] UI para elegir OpenAI, Anthropic o Groq e introducir API key.
- [x] Validación de conectividad y guardado seguro de settings.

### 11.6 Robustez de generación de tests con modelos pequeños

- [x] Normalizar `isCorrect` (string/number → boolean) en preguntas TRUE_FALSE.
- [x] Normalizar `isCorrectIndex` y opciones en MULTIPLE_CHOICE.
- [x] Detectar y corregir opciones marcadas como "Correcta" en MULTIPLE_CHOICE.
- [x] Forzar el tipo esperado cuando el modelo lo omite o lo escribe mal.
- [x] Reintento automático con prompt más corto si la primera generación falla.
- [x] Rellenar preguntas faltantes con llamadas adicionales hasta alcanzar `questionCount`.
- [x] Truncar si el modelo genera más preguntas de las solicitadas.
- [x] Prompt más explícito con ejemplo concreto, system message y reglas por tipo.
- [x] Cambiar ejemplo concreto por placeholders para evitar prompt leaking en modelos pequeños.
- [x] Advertencias explícitas de no copiar el ejemplo.
- [x] Tests de normalización, reintento y relleno.

### 11.7 Fix: revalidatePath en jobs en segundo plano

- [x] Eliminar `revalidatePath` de `src/modules/tests/job.ts`.
- [x] Eliminar `revalidatePath` de `src/modules/documents/job.ts`.
- [x] Eliminar `revalidatePath` de `src/modules/summaries/job.ts`.
- [x] Mantener `revalidatePath` solo en Server Actions síncronas (mutations).
- [x] Pipeline verde tras el cambio.

---

## 12. Internacionalización (i18n) — Opción B completa

**Objetivo:** permitir que toda la aplicación esté en español o inglés, incluyendo la UI, los mensajes del sistema, los prompts de IA y el contenido generado (tests, chat, resúmenes).

### 12.1 Tecnología

- [x] Usar `next-intl` como librería de i18n para Next.js App Router.
- [x] Idiomas soportados inicialmente: `es` (default) y `en`.
- [x] Mensajes almacenados en `messages/<locale>/<namespace>.json`.

### 12.2 Schema y persistencia

- [x] Añadir campo `language` al modelo `AppSettings` en Prisma (string con default `"es"`).
- [x] Exponer `language` en `getEffectiveSettings()`.
- [x] Guardar preferencia desde `/settings` con un selector de idioma.
- [x] Usar cookie `NEXT_LOCALE` como fallback/secundario para visitantes sin sesión.

### 12.3 Configuración de next-intl

- [x] Instalar `next-intl`.
- [x] Crear `src/i18n/routing.ts` con locales y prefijos de ruta opcionales.
- [x] Crear `src/i18n/request.ts` para cargar mensajes según locale.
- [x] Crear middleware `src/middleware.ts` que detecte/guarde el locale.
- [x] Envolver `src/app/layout.tsx` con `NextIntlClientProvider`.

### 12.4 Extracción de textos de la UI

- [x] Reemplazar todos los textos hardcodeados en componentes y páginas por `useTranslations()` (client) o `getTranslations()` (server).
- [x] Agrupar mensajes por namespaces: `navigation`, `dashboard`, `folders`, `subjects`, `documents`, `tests`, `chat`, `summaries`, `settings`, `errors`, `common`.
- [x] Revisar componentes compartidos: `EmptyState`, `ConfirmDialog`, `StatusBadge`, `Spinner`, etc.

### 12.5 Server Actions y mensajes de error

- [x] Las Server Actions devuelven `ActionResult<T>` con un `ErrorCode` (`src/lib/errors.ts`).
- [x] `action()` y `classifyError()` en `src/lib/action-utils.ts` etiquetan errores de Zod, Prisma y servicios externos con códigos traducibles.
- [x] Los componentes cliente usan `useErrorMessage()` (`src/hooks/use-error-message.ts`) para traducir `AppError` usando su `code` y caer en `message` como fallback.
- [x] Las claves de error se añadieron a `messages/es/errors.json` y `messages/en/errors.json`.
- [x] No se expone al cliente el mensaje crudo de Prisma, Ollama o stacks internos.

### 12.6 Prompts de IA según idioma

- [x] Inyectar el idioma activo (`es` / `en`) en todos los prompts:
  - `test-generator.ts`: añade `language` a `GenerateTestOptions` e incluye la instrucción de idioma en el system message.
  - `rag.ts`: añade `language` a `RAGOptions`, genera el system prompt dinámicamente y localiza el mensaje de "sin fuentes".
  - `summaries/job.ts`: genera el resumen en el idioma seleccionado mediante `languageInstruction`.
- [x] El contenido generado (preguntas, respuestas, resúmenes) respeta el idioma activo al encolar el job.
- [x] Los jobs en segundo plano reciben el locale en el `payload` de `enqueueJob` y lo pasan a las funciones de IA.

### 12.7 Fechas, números y formato

- [x] Usar `Intl.DateTimeFormat` / `useFormatter` de `next-intl` para fechas y números.
- [x] Ajustar formatos de nota, porcentajes y fechas según locale.

### 12.8 Selector de idioma

- [x] Añadir selector en `/settings` para cambiar entre español e inglés.
- [x] Aplicar cambio inmediatamente (guardar en BD y cookie, refrescar).
- [x] Selector compacto añadido en el header/footer si es necesario.

### 12.9 Tests

- [x] Añadir tests para carga de mensajes y cambio de locale.
- [x] Verificar que Server Actions devuelven códigos de error traducibles (`ErrorCode`).
- [x] Verificar que los prompts de IA incluyen la instrucción de idioma correcta.
- [x] Pipeline CI verde tras todos los cambios.

### 12.10 Criterios de éxito

- [x] `next-intl` configurado y funcionando.
- [x] Campo `language` en `AppSettings` con UI para cambiarlo.
- [x] Todos los textos de la UI extraídos a `messages/*.json`.
- [x] Mensajes de error de Server Actions traducidos mediante `ErrorCode` + `useErrorMessage`.
- [x] Prompts de IA adaptados al idioma seleccionado y jobs en segundo plano recibiendo locale.
- [x] Tests de i18n y pipeline verde.
