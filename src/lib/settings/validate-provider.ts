"use server";

import { z } from "zod";
import { action, parseFormData } from "@/lib/action-utils";
import { ActionResult, AppErrorClass } from "@/lib/errors";
import { ChatProvider } from "@/lib/settings/types";
import { OpenAIChatProvider } from "@/modules/ai/providers/openai";
import { AnthropicChatProvider } from "@/modules/ai/providers/anthropic";
import { GroqChatProvider } from "@/modules/ai/providers/groq";

const validateExternalProviderSchema = z.object({
  provider: z.enum([
    ChatProvider.OPENAI,
    ChatProvider.ANTHROPIC,
    ChatProvider.GROQ,
  ]),
  apiKey: z.string().min(1, "La API key es obligatoria"),
  baseUrl: z.string().optional(),
  chatModel: z.string().optional(),
});

export type ValidateExternalProviderInput = z.infer<
  typeof validateExternalProviderSchema
>;

function createProvider(input: ValidateExternalProviderInput) {
  const { provider, apiKey, baseUrl, chatModel } = input;
  const model = chatModel ?? "default";

  switch (provider) {
    case ChatProvider.OPENAI:
      return new OpenAIChatProvider({ apiKey, model, baseUrl });
    case ChatProvider.ANTHROPIC:
      return new AnthropicChatProvider({ apiKey, model, baseUrl });
    case ChatProvider.GROQ:
      return new GroqChatProvider({ apiKey, model, baseUrl });
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Proveedor no soportado: ${_exhaustive}`);
    }
  }
}

export async function validateExternalProvider(
  data: ValidateExternalProviderInput
): Promise<ActionResult<{ ok: boolean; models?: string[] }>> {
  const parsed = parseFormData(validateExternalProviderSchema, data);

  if (!parsed.success) {
    return {
      success: false,
      error: {
        type: "USER_ERROR",
        message: "Los datos enviados no son válidos.",
        code: "VALIDATION_ERROR",
      },
      fieldErrors: parsed.fieldErrors,
    };
  }

  return action(async () => {
    const provider = createProvider(parsed.data);

    try {
      const isHealthy = await provider.health();

      if (!isHealthy) {
        throw new AppErrorClass(
          "USER_ERROR",
          "No se ha podido conectar con el proveedor. Comprueba la API key y la URL base."
        );
      }
    } catch (error) {
      if (error instanceof AppErrorClass) {
        throw error;
      }
      throw new AppErrorClass(
        "SYSTEM_ERROR",
        "No se ha podido conectar con el proveedor. Comprueba la API key y la URL base."
      );
    }

    return { ok: true };
  });
}
