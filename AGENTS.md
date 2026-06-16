# Convenciones de desarrollo

## Accesibilidad (a11y)

Todo componente interactivo debe ser usable sin ratón y anunciable por lectores de pantalla.

- **Foco**: todos los controles interactivos deben tener un foco visible. Usa `focus-visible:ring-2 focus-visible:ring-ring` o equivalente. No elimines `outline` sin alternativa.
- **Labels**: todo `<input>`, `<select>` y `<textarea>` debe tener un `<label>` visible asociado (`htmlFor` + `id`). Para selects de `@base-ui/react`, envuelve en `<SelectField>` y usa `<AccessibleSelectTrigger>`.
- **Errores**: los mensajes de error deben estar vinculados al control con `aria-describedby="{id}-error"` y usar `aria-invalid="true"`. Usa `<FormError>` o `<FormField error={...}>`.
- **Botones icono**: si un botón solo contiene un icono, añade `aria-label` descriptivo.
- **Listados**: usa `<ul>`/`<li>` para grids de tarjetas y asegura que cada card tenga un heading (`<h2>` o `<h3>`) con `CardTitle as="..."`.
- **Estados vacíos**: envuelve en un elemento con `role="status"` y ofrece una acción clara.
- **Chat**: envuelve mensajes en una region con `role="log" aria-live="polite"`; cada burbuja usa `role="article"` y `aria-label` indicando el autor.
- **Tests**: agrupa cada pregunta en `<fieldset>/<legend>`; las opciones múltiples usan `role="radiogroup"`.
- **Toasts**: usa `useToast()` para notificaciones. Los toasts se renderizan en una region con `aria-live="polite"`.
- **Motion**: respeta `prefers-reduced-motion` (ya configurado en `globals.css`). No añadas animaciones esenciales para entender el contenido.

## UI/UX

- Usa los componentes base de `src/components/ui/`. No crees estilos ad hoc si existe un componente.
- Para enlaces con apariencia de botón, usa `<LinkButton>` en lugar de anidar `<Button>` dentro de `<Link>`.
- Mantén el tema visual coherente: usa tokens de Tailwind (`bg-primary`, `text-muted-foreground`, etc.).
- Añade `aria-hidden="true"` a iconos decorativos.
- Los diálogos deben incluir siempre `<DialogTitle>` y, preferiblemente, `<DialogDescription>`.

## Gestión de errores

- Las Server Actions deben devolver un `ActionResult<T>` (`src/lib/errors.ts`) en lugar de lanzar errores crudos.
- Usa `action()` y `parseFormData()` de `src/lib/action-utils.ts` para clasificar errores:
  - `USER_ERROR`: validación, recursos no encontrados, datos inválidos.
  - `SYSTEM_ERROR`: fallos de BD, Ollama, red u otros errores internos.
- Asigna un `ErrorCode` (`src/lib/errors.ts`) a cada error clasificado. El servidor devuelve el código; el cliente traduce el mensaje.
- En componentes cliente, usa `useErrorMessage()` (`src/hooks/use-error-message.ts`) para traducir `AppError` a texto legible: `const getErrorMessage = useErrorMessage(); getErrorMessage(result.error)`.
- No leas `result.error.message` directamente en la UI salvo que sea para logs o debugging.
- No expongas mensajes crudos de Prisma, Ollama o stacks al cliente.
- Mapea los errores de validación de Zod a los campos correspondientes del formulario (`fieldErrors`).
- Muestra errores de sistema mediante `useToast()`; errores de campo mediante `<FormField error={...}>`. 

## Internacionalización (i18n)

- La aplicación usa `next-intl`. Los mensajes están en `messages/<locale>/<namespace>.json`.
- Idiomas soportados: `es` (por defecto) y `en`.
- Client Components: `useTranslations("namespace")`. Server Components: `getTranslations("namespace")`.
- Fechas y números: `useFormatter()` (cliente) o `Intl.DateTimeFormat`/`Intl.NumberFormat` (servidor).
- El locale activo se resuelve en `src/lib/i18n/locale.ts`: cookie `NEXT_LOCALE` primero, luego `AppSettings.language`, luego `es`.
- Los jobs en segundo plano no tienen contexto de request. Pasa el locale en el `payload` de `enqueueJob` y recupéralo con `getLocaleFromPayload(payload)` en `src/lib/i18n/jobs.ts`.
- Los prompts de IA deben incluir la instrucción de idioma. Reciben el locale como parámetro (`language`) y ajustan el system/user prompt.
- Las Server Actions críticas que encolan jobs (`createTest`, `generateSummary`, `startChatResponse`, etc.) deben obtener `getLocale()` y enviarlo en el payload.
- No hardcodees texto de UI, mensajes de éxito ni valores por defecto de `language` en componentes de configuración.

## Arquitectura de procesos en segundo plano

- Todo proceso largo que pueda superar el timeout de una Server Action (procesar documentos, generar tests, generar resúmenes, responder en chat) debe ejecutarse en segundo plano mediante `enqueueJob` de `src/lib/jobs/runner.ts`.
- El job debe persistir su estado (`status`, `progress`, `errorMessage`) en Prisma para que el cliente pueda consultarlo.
- El cliente recibe actualizaciones en tiempo real a través de endpoints SSE bajo `/api/<recurso>/[id]/progress`.
- Protocolo SSE unificado (`src/lib/sse.ts`): emite `event: progress` con el estado actual; `event: error` con `{ message, code? }` cuando falla; y `event: complete` con el estado final al terminar con éxito. Usa `createSSEStream` y no inventes payloads alternativos.
- Nunca bloquees la respuesta HTTP esperando a que termine un job.

## Estructura de módulos

Cada feature en `src/modules/<feature>/` debe organizarse con responsabilidad única:

- `queries.ts` — lecturas de base de datos.
- `mutations.ts` — escrituras, borrados y encolado de jobs.
- `schemas.ts` — schemas Zod.
- `types.ts` — tipos locales/exportados.
- `actions.ts` — barrel público que re-exporta funciones y tipos. No añadas lógica aquí.
- `job.ts` — runner de procesos en segundo plano (si aplica).
- `components/` — componentes React de la feature.

## Tests

- Los tests de accesibilidad de componentes usan `// @vitest-environment jsdom` y el helper `expectNoViolations` de `src/lib/test/a11y.ts`.
- Limpia el DOM después de cada test de componente con `afterEach(cleanup)`.
- Cada acción, job, endpoint SSE y componente nuevo debe incluir tests que cubran el caso feliz, errores y estados intermedios.
- El pipeline debe pasar siempre: `npx tsc --noEmit && npm run lint && npm run test && npm run build`.
