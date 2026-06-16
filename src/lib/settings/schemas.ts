import { z } from "zod";
import { ChatProvider, EmbeddingProvider, Language } from "./types";

export const settingsSchema = z.object({
  chatProvider: z.enum([
    ChatProvider.OLLAMA,
    ChatProvider.OPENAI,
    ChatProvider.ANTHROPIC,
    ChatProvider.GROQ,
  ]),
  chatModel: z.string().min(1, "El modelo de chat es obligatorio"),
  embeddingProvider: z.enum([EmbeddingProvider.OLLAMA]),
  embeddingModel: z.string().min(1, "El modelo de embeddings es obligatorio"),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  language: z
    .enum([Language.ES, Language.EN])
    .optional()
    .default(Language.ES),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
