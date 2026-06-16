import { ChatProvider } from "@/lib/settings/types";

export const EXTERNAL_PROVIDER_DEFAULT_BASE_URLS: Record<
  Exclude<ChatProvider, "ollama">,
  string
> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  groq: "https://api.groq.com/openai/v1",
};

export const EXTERNAL_MODELS: Record<
  Exclude<ChatProvider, "ollama">,
  { value: string; label: string }[]
> = {
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o mini" },
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
  ],
  groq: [
    { value: "llama3-8b-8192", label: "Llama 3 8B" },
    { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
    { value: "gemma2-9b-it", label: "Gemma 2 9B" },
  ],
};

export function getExternalModels(
  provider: Exclude<ChatProvider, "ollama">
): { value: string; label: string }[] {
  return EXTERNAL_MODELS[provider];
}

export function getExternalProviderDefaultBaseUrl(
  provider: Exclude<ChatProvider, "ollama">
): string {
  return EXTERNAL_PROVIDER_DEFAULT_BASE_URLS[provider];
}
