export const ChatProvider = {
  OLLAMA: "ollama",
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
  GROQ: "groq",
} as const;
export type ChatProvider = (typeof ChatProvider)[keyof typeof ChatProvider];

export const EmbeddingProvider = {
  OLLAMA: "ollama",
} as const;
export type EmbeddingProvider =
  (typeof EmbeddingProvider)[keyof typeof EmbeddingProvider];

export const Language = {
  ES: "es",
  EN: "en",
} as const;
export type Language = (typeof Language)[keyof typeof Language];

export type AppSettings = {
  id: string;
  chatProvider: ChatProvider;
  chatModel: string;
  embeddingProvider: EmbeddingProvider;
  embeddingModel: string;
  apiKey?: string;
  baseUrl?: string;
  language: Language;
  createdAt: Date;
  updatedAt: Date;
};
