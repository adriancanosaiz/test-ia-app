"use server";

import { getEffectiveSettings } from "@/lib/settings";
import { ChatProvider } from "@/lib/settings/types";
import { validateEmbeddingDimensions } from "./provider";
import { validateOllamaModels } from "./ollama";

export type OllamaStatus = {
  models: {
    chatAvailable: boolean;
    embeddingAvailable: boolean;
    availableModels: string[];
  };
  dimensions: {
    configured: number;
    expected: number;
    valid: boolean;
  };
};

export async function checkOllamaStatus(): Promise<
  | { success: true; data: OllamaStatus }
  | { success: false; error: string; code?: string }
> {
  try {
    const settings = await getEffectiveSettings();
    const dimensionsResult = await validateEmbeddingDimensions();

    if (settings.chatProvider !== ChatProvider.OLLAMA) {
      const status: OllamaStatus = {
        models: {
          chatAvailable: true,
          embeddingAvailable: true,
          availableModels: [],
        },
        dimensions: {
          configured: Number(process.env.OLLAMA_EMBEDDING_DIMENSIONS || "768"),
          expected: 768,
          valid: dimensionsResult.success,
        },
      };

      if (!dimensionsResult.success) {
        return {
          success: false,
          error: dimensionsResult.error.message,
          code: dimensionsResult.error.code,
        };
      }

      return { success: true, data: status };
    }

    const [modelsResult] = await Promise.all([
      validateOllamaModels(settings.baseUrl),
    ]);

    const status: OllamaStatus = {
      models:
        modelsResult.success && modelsResult.data
          ? modelsResult.data
          : {
              chatAvailable: false,
              embeddingAvailable: false,
              availableModels: [],
            },
      dimensions: {
        configured: Number(process.env.OLLAMA_EMBEDDING_DIMENSIONS || "768"),
        expected: 768,
        valid: dimensionsResult.success,
      },
    };

    if (!modelsResult.success) {
      return {
        success: false,
        error: modelsResult.error.message,
        code: modelsResult.error.code,
      };
    }

    if (!dimensionsResult.success) {
      return {
        success: false,
        error: dimensionsResult.error.message,
        code: dimensionsResult.error.code,
      };
    }

    return { success: true, data: status };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    return { success: false, error: message };
  }
}
