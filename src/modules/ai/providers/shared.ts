import { z } from "zod";
import { AppErrorClass } from "@/lib/errors";

export function sanitizeJSON(raw: string): string {
  const match = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (match) return match[1].trim();
  return raw.trim();
}

export function parseJSONResponse<T>(raw: string, schema: z.ZodSchema<T>): T {
  const sanitized = sanitizeJSON(raw);
  try {
    const parsed = JSON.parse(sanitized || "{}") as unknown;
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppErrorClass(
        "USER_ERROR",
        `La respuesta no cumple el formato JSON esperado: ${error.issues.map((issue) => issue.message).join(", ")}`,
        "AI_INVALID_JSON_SCHEMA"
      );
    }
    throw new AppErrorClass(
      "SYSTEM_ERROR",
      `La respuesta no es un JSON válido: ${error instanceof Error ? error.message : String(error)}`,
      "AI_INVALID_JSON"
    );
  }
}

export function buildJSONSystemPrompt(): string {
  return (
    "You are a helpful assistant. Respond ONLY with a valid JSON object. " +
    "Do not include markdown code blocks, explanations or any text outside the JSON object."
  );
}
