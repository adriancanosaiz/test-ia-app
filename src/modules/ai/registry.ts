import { AppSettings, ChatProvider } from "@/lib/settings/types";
import { AIProvider, ChatProvider as ChatProviderInterface, EmbeddingProvider } from "./provider";
import { OllamaChatProvider, OllamaEmbeddingProvider } from "./providers/ollama";
import { OpenAIChatProvider } from "./providers/openai";
import { AnthropicChatProvider } from "./providers/anthropic";
import { GroqChatProvider } from "./providers/groq";

export function getChatProvider(settings: AppSettings): ChatProviderInterface {
  switch (settings.chatProvider) {
    case ChatProvider.OLLAMA:
      return new OllamaChatProvider(settings.chatModel, settings.baseUrl);
    case ChatProvider.OPENAI:
      return new OpenAIChatProvider({
        apiKey: settings.apiKey ?? "",
        model: settings.chatModel,
        baseUrl: settings.baseUrl,
      });
    case ChatProvider.ANTHROPIC:
      return new AnthropicChatProvider({
        apiKey: settings.apiKey ?? "",
        model: settings.chatModel,
        baseUrl: settings.baseUrl,
      });
    case ChatProvider.GROQ:
      return new GroqChatProvider({
        apiKey: settings.apiKey ?? "",
        model: settings.chatModel,
        baseUrl: settings.baseUrl,
      });
    default: {
      const _exhaustive: never = settings.chatProvider;
      throw new Error(`Proveedor de chat no soportado: ${_exhaustive}`);
    }
  }
}

export function getEmbeddingProvider(settings: AppSettings): EmbeddingProvider {
  return new OllamaEmbeddingProvider(settings.embeddingModel, settings.baseUrl);
}

export function getAIProvider(settings: AppSettings): AIProvider {
  return {
    chat: getChatProvider(settings),
    embedding: getEmbeddingProvider(settings),
  };
}
