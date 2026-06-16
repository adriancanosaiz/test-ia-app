import { z } from "zod";

export const createSessionSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  sourceDocumentId: z.string().optional(),
});

export const addUserMessageSchema = z.object({
  sessionId: z.union([z.string(), z.null()]).optional(),
  question: z
    .string()
    .min(1, "La pregunta es obligatoria")
    .max(2000, "La pregunta no puede superar los 2000 caracteres"),
  sourceDocumentId: z.string().optional(),
});

export const messageActionSchema = z.object({
  sessionId: z.string().min(1, "La sesión es obligatoria"),
  assistantMessageId: z.string().min(1, "El mensaje es obligatorio"),
});
