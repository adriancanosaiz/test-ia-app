import { z } from "zod";
import { Difficulty, QuestionType, SourceType } from "@prisma/client";
import { ChatProvider as ChatProviderInterface, getCurrentAIProvider } from "./provider";
import { OllamaChatProvider } from "./providers/ollama";
import { assertOllamaModels } from "./ollama";
import { retrieveChunksForScope, RetrievedChunk } from "./retrieval";

// El modelo local a veces devuelve explanation: null, "" u omite el campo.
// Limpiamos esos valores a undefined para mantener la compatibilidad con Prisma.
const explanationSchema = z.preprocess(
  (value) =>
    value === null || value === undefined || value === "" ? undefined : value,
  z.string().min(1).optional()
);

const multipleChoiceSchema = z.object({
  type: z.literal("MULTIPLE_CHOICE"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  content: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(6),
  isCorrectIndex: z.number().int().min(0),
  explanation: explanationSchema,
});

const trueFalseSchema = z.object({
  type: z.literal("TRUE_FALSE"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  content: z.string().min(1),
  isCorrect: z.boolean(),
  explanation: explanationSchema,
});

const shortAnswerSchema = z.object({
  type: z.literal("SHORT_ANSWER"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  content: z.string().min(1),
  modelAnswer: z.string().min(1),
  explanation: explanationSchema,
});

const questionSchema = z.union([
  multipleChoiceSchema,
  trueFalseSchema,
  shortAnswerSchema,
]);

export type GeneratedQuestion = z.infer<typeof questionSchema>;
export type GeneratedTest = { questions: GeneratedQuestion[] };

export interface GenerateTestOptions {
  sourceType: SourceType;
  sourceId: string;
  questionType: QuestionType;
  difficulty: Difficulty;
  questionCount: number;
  onProgress?: (progress: number) => void | Promise<void>;
  provider?: ChatProviderInterface;
  language?: string;
}

// Límite aproximado de tokens de contexto enviados al modelo para generar tests.
// Un contexto más pequeño genera más rápido y reduce timeouts en hardware modesto.
const MAX_CONTEXT_TOKENS = 4000;

function getFormatExample(questionType: QuestionType, difficulty: string): string {
  switch (questionType) {
    case "MULTIPLE_CHOICE":
      return `{
  "questions": [
    {
      "type": "MULTIPLE_CHOICE",
      "difficulty": "${difficulty}",
      "content": "[PREGUNTA BASADA EN EL CONTEXTO]",
      "options": ["[OPCIÓN 1]", "[OPCIÓN 2]", "[OPCIÓN 3]", "[OPCIÓN 4]"],
      "isCorrectIndex": 0,
      "explanation": "[EXPLICACIÓN OPCIONAL]"
    }
  ]
}`;
    case "TRUE_FALSE":
      return `{
  "questions": [
    {
      "type": "TRUE_FALSE",
      "difficulty": "${difficulty}",
      "content": "[AFIRMACIÓN BASADA EN EL CONTEXTO]",
      "isCorrect": true,
      "explanation": "[EXPLICACIÓN OPCIONAL]"
    }
  ]
}`;
    case "SHORT_ANSWER":
      return `{
  "questions": [
    {
      "type": "SHORT_ANSWER",
      "difficulty": "${difficulty}",
      "content": "[PREGUNTA BASADA EN EL CONTEXTO]",
      "modelAnswer": "[RESPUESTA CORRECTA ESPERADA]",
      "explanation": "[EXPLICACIÓN OPCIONAL]"
    }
  ]
}`;
  }
}

function getFieldRules(questionType: QuestionType): string {
  switch (questionType) {
    case "MULTIPLE_CHOICE":
      return `- "options" debe ser un array de strings no vacíos (mínimo 2, máximo 6). SOLO las opciones de respuesta, nada más.
- "isCorrectIndex" debe ser un número entero que indique la posición de la opción correcta (empezando en 0).
- IMPORTANTE: NO incluyas palabras como "Correcta" o "Correcto" dentro de "options". La opción correcta se indica ÚNICAMENTE con "isCorrectIndex".`;
    case "TRUE_FALSE":
      return `- "isCorrect" debe ser EXACTAMENTE true o false (booleano, sin comillas).
- No uses strings como "true" o "false", ni números.`;
    case "SHORT_ANSWER":
      return `- "modelAnswer" debe ser un string no vacío con la respuesta correcta esperada.`;
  }
}

function buildContext(chunks: RetrievedChunk[], maxTokens: number): string {
  const maxChars = maxTokens * 4; // aproximación ~4 caracteres/token
  const parts: string[] = [];
  let usedChars = 0;

  for (const chunk of chunks) {
    const header = `[${parts.length + 1}] Fragmento de ${chunk.documentTitle} (${chunk.subjectName}):\n`;
    const available = Math.max(0, maxChars - usedChars - header.length);
    if (available === 0) break;

    const content = chunk.content.slice(0, available);
    parts.push(header + content);
    usedChars += header.length + content.length;
  }

  return parts.join("\n\n---\n\n");
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes" || lower === "sí" || lower === "si") return true;
    if (lower === "false" || lower === "0" || lower === "no") return false;
  }
  if (typeof value === "number") return value !== 0;
  return undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function normalizeQuestion(
  raw: unknown,
  expectedType: QuestionType
): unknown {
  if (typeof raw !== "object" || raw === null) {
    return raw;
  }

  const record = raw as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...record };

  // Normalizar el tipo: si falta o está mal escrito, forzar el tipo solicitado.
  const rawType = normalizeString(record.type);
  if (
    rawType === "MULTIPLE_CHOICE" ||
    rawType === "TRUE_FALSE" ||
    rawType === "SHORT_ANSWER"
  ) {
    normalized.type = rawType;
  } else {
    normalized.type = expectedType;
  }

  // Normalizar dificultad si viene mal.
  const rawDifficulty = normalizeString(record.difficulty);
  if (
    rawDifficulty === "EASY" ||
    rawDifficulty === "MEDIUM" ||
    rawDifficulty === "HARD"
  ) {
    normalized.difficulty = rawDifficulty;
  }

  // Normalizar contenido.
  const content = normalizeString(record.content);
  if (content !== undefined) {
    normalized.content = content;
  }

  // Campos específicos por tipo.
  if (normalized.type === "TRUE_FALSE") {
    const boolValue = normalizeBoolean(record.isCorrect);
    if (boolValue !== undefined) {
      normalized.isCorrect = boolValue;
    }
  }

  if (normalized.type === "MULTIPLE_CHOICE") {
    const index = normalizeNumber(record.isCorrectIndex);
    if (index !== undefined) {
      normalized.isCorrectIndex = index;
    }
    if (Array.isArray(record.options)) {
      const rawOptions = record.options
        .map((opt) => normalizeString(opt))
        .filter((opt): opt is string => opt !== undefined);

      // Algunos modelos pequeños marcan la respuesta correcta incluyendo
      // la palabra "Correcta" como elemento del array en lugar de usar
      // isCorrectIndex. Detectamos ese patrón y lo corregimos.
      const markerRegex = /^(correct[ao]?|respuesta correct[ao]?|right answer|correct answer)$/i;
      const cleanedOptions: string[] = [];
      let detectedCorrectIndex: number | undefined;

      for (let i = 0; i < rawOptions.length; i++) {
        const opt = rawOptions[i];
        if (markerRegex.test(opt)) {
          if (detectedCorrectIndex === undefined) {
            detectedCorrectIndex = cleanedOptions.length > 0 ? cleanedOptions.length - 1 : i;
          }
        } else {
          cleanedOptions.push(opt);
        }
      }

      // Si encontramos un marcador y no había isCorrectIndex, usamos el detectado.
      if (detectedCorrectIndex !== undefined && normalized.isCorrectIndex === undefined) {
        normalized.isCorrectIndex = Math.min(
          detectedCorrectIndex,
          Math.max(0, cleanedOptions.length - 1)
        );
      }

      normalized.options = cleanedOptions;
    }
  }

  if (normalized.type === "SHORT_ANSWER") {
    const modelAnswer = normalizeString(record.modelAnswer);
    if (modelAnswer !== undefined) {
      normalized.modelAnswer = modelAnswer;
    }
  }

  // Limpiar explanation.
  const explanation = normalizeString(record.explanation);
  if (explanation === undefined) {
    delete normalized.explanation;
  } else {
    normalized.explanation = explanation;
  }

  return normalized;
}

function normalizeRawResult(
  rawResult: { questions?: unknown[] },
  expectedType: QuestionType
): { questions?: unknown[] } {
  if (!Array.isArray(rawResult.questions)) {
    return rawResult;
  }

  return {
    questions: rawResult.questions.map((q) => normalizeQuestion(q, expectedType)),
  };
}

function buildPrompt(
  options: GenerateTestOptions,
  context: string,
  isRetry = false
): string {
  const baseRules = `REGLAS OBLIGATORIAS:
- Genera EXACTAMENTE ${options.questionCount} preguntas, ni más ni menos.
- TODAS las preguntas deben ser del tipo ${options.questionType}.
- Cada pregunta debe poder responderse ÚNICAMENTE con la información del contexto.
- Las preguntas deben ser ORIGINALES y basadas en el contexto. NO copies el contenido del ejemplo de formato.
- No inventes información que no esté en el contexto.
- Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni explicaciones fuera del JSON.
- El campo "questions" debe ser un array de objetos.
- Cada objeto de pregunta debe incluir TODOS los campos requeridos para su tipo.
- El campo "explanation" es opcional; si no lo usas, omítelo.`;

  const fieldRules = getFieldRules(options.questionType);

  const formatExample = getFormatExample(options.questionType, options.difficulty);

  if (isRetry) {
    return `Intento anterior fallido. Genera EXACTAMENTE ${options.questionCount} preguntas de tipo ${options.questionType} con dificultad ${options.difficulty}.

${baseRules}

REGLAS ESPECÍFICAS DEL TIPO:
${fieldRules}

FORMATO EXACTO:

${formatExample}

[CONTEXTO]\n\n${context}\n\n[FIN CONTEXTO]`;
  }

  return `Genera exactamente ${options.questionCount} preguntas de tipo ${options.questionType} con dificultad ${options.difficulty} basadas ÚNICAMENTE en el siguiente contexto.

${baseRules}

REGLAS ESPECÍFICAS DEL TIPO:
${fieldRules}

FORMATO EXACTO (la respuesta completa debe ser un objeto JSON como este):

${formatExample}

[CONTEXTO]\n\n${context}\n\n[FIN CONTEXTO]`;
}

async function parseGeneratedQuestions(
  rawResult: { questions?: unknown[] },
  options: GenerateTestOptions
): Promise<GeneratedQuestion[]> {
  const normalized = normalizeRawResult(rawResult, options.questionType);

  if (!Array.isArray(normalized.questions)) {
    throw new Error(
      'La respuesta del modelo no contiene el campo "questions" con un array de preguntas. Inténtalo de nuevo o prueba con un modelo más compatible con JSON.'
    );
  }

  // Truncamos si genera de más; si genera de menos, devolvemos las válidas
  // y dejamos que el llamador decida si rellenar o reportar.
  const candidates = normalized.questions.slice(0, options.questionCount);

  const parsedQuestions: GeneratedQuestion[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const rawQuestion = candidates[i];
    const parseResult = questionSchema.safeParse(rawQuestion);

    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((issue) => issue.message)
        .join("; ");
      throw new Error(
        `La pregunta ${i + 1} no tiene el formato válido: ${issues}. Verifica que el modelo siga exactamente el ejemplo del tipo ${options.questionType}.`
      );
    }

    const question = parseResult.data;

    if (question.type !== options.questionType) {
      throw new Error(
        `La pregunta ${i + 1} es de tipo ${question.type} en lugar de ${options.questionType}`
      );
    }

    if (question.type === "MULTIPLE_CHOICE") {
      const maxIndex = Math.max(0, question.options.length - 1);
      const correctedIndex = Math.min(
        Math.max(0, question.isCorrectIndex),
        maxIndex
      );
      if (correctedIndex !== question.isCorrectIndex) {
        parsedQuestions.push({
          ...question,
          isCorrectIndex: correctedIndex,
        });
        continue;
      }
    }

    parsedQuestions.push(question);
  }

  return parsedQuestions;
}

async function tryGenerateQuestions(
  options: GenerateTestOptions,
  context: string,
  chatProvider: ChatProviderInterface,
  isRetry = false
): Promise<GeneratedQuestion[]> {
  const prompt = buildPrompt(options, context, isRetry);

  const language = options.language ?? "es";
  const languageInstruction =
    language === "en"
      ? "Answer in English unless asked otherwise."
      : "Responde en español salvo que se te pida lo contrario.";

  const systemMessage =
    "Eres un generador de tests. DEVUELVES ÚNICAMENTE JSON VÁLIDO. " +
    "Nunca añadas texto fuera del JSON. " +
    "El ejemplo de formato que recibas es solo eso: un ejemplo de formato. " +
    "NO copies el contenido del ejemplo. Genera preguntas ORIGINALES a partir del contexto proporcionado. " +
    "En opción múltiple, la respuesta correcta se indica con el campo isCorrectIndex, " +
    "NUNCA escribiendo 'Correcta' como opción. " +
    languageInstruction;

  const rawResult = await chatProvider.completeJSON(
    [
      { role: "system", content: systemMessage },
      { role: "user", content: prompt },
    ],
    z.object({ questions: z.array(z.any()).optional() }),
    { temperature: isRetry ? 0.1 : 0.2, maxTokens: 4096 }
    // timeoutMs por defecto: getOllamaGenerationTimeoutMs() (5 min)
  );

  return parseGeneratedQuestions(rawResult, options);
}

const MAX_FILL_ATTEMPTS = 3;

export async function generateTestQuestions(
  options: GenerateTestOptions
): Promise<{ questions: GeneratedQuestion[]; sources: RetrievedChunk[] }> {
  const chatProvider = options.provider ?? (await getCurrentAIProvider()).chat;

  if (chatProvider instanceof OllamaChatProvider) {
    await assertOllamaModels();
  }

  const chunks = await retrieveChunksForScope(
    options.sourceType,
    options.sourceId,
    Math.max(options.questionCount * 2, 10)
  );

  await options.onProgress?.(30);

  const language = options.language ?? "es";

  if (chunks.length === 0) {
    throw new Error(
      language === "en"
        ? "There is no indexed content to generate the test"
        : "No hay contenido indexado para generar el test"
    );
  }

  const context = buildContext(chunks, MAX_CONTEXT_TOKENS);

  await options.onProgress?.(50);

  let questions: GeneratedQuestion[] = [];
  let lastError: Error | undefined;

  try {
    questions = await tryGenerateQuestions(options, context, chatProvider);
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
    // Primer intento fallido: reintentar una vez con prompt más corto.
    try {
      questions = await tryGenerateQuestions(options, context, chatProvider, true);
      lastError = undefined;
    } catch (retryError) {
      lastError = retryError instanceof Error ? retryError : lastError;
    }
  }

  // Si el modelo devolvió menos preguntas de las solicitadas, intentamos
  // generar las faltantes en llamadas adicionales (muy útil para modelos 1B).
  let fillAttempts = 0;
  while (
    questions.length < options.questionCount &&
    fillAttempts < MAX_FILL_ATTEMPTS
  ) {
    const missing = options.questionCount - questions.length;
    const missingOptions: GenerateTestOptions = {
      ...options,
      questionCount: missing,
    };

    await options.onProgress?.(55 + Math.round((fillAttempts / MAX_FILL_ATTEMPTS) * 25));

    try {
      const extra = await tryGenerateQuestions(
        missingOptions,
        context,
        chatProvider,
        true
      );
      questions = [...questions, ...extra].slice(0, options.questionCount);
      lastError = undefined;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    fillAttempts++;
  }

  await options.onProgress?.(90);

  if (questions.length < options.questionCount) {
    const baseMessage = `El modelo generó ${questions.length} preguntas en lugar de ${options.questionCount}`;
    const detailMessage = lastError ? `: ${lastError.message}` : "";
    throw new Error(`${baseMessage}${detailMessage}`);
  }

  return { questions, sources: chunks };
}
