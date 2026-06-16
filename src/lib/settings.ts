import { prisma } from "@/lib/prisma";
import { action } from "@/lib/action-utils";
import { ActionResult } from "@/lib/errors";
import type { AppSettings as PrismaAppSettings } from "@prisma/client";
import {
  AppSettings,
  ChatProvider,
  EmbeddingProvider,
  Language,
} from "./settings/types";

function mapPrismaSettings(settings: PrismaAppSettings): AppSettings {
  return {
    ...settings,
    chatProvider: settings.chatProvider as ChatProvider,
    embeddingProvider: settings.embeddingProvider as EmbeddingProvider,
    language: (settings.language as Language) ?? Language.ES,
    apiKey: settings.apiKey ?? undefined,
    baseUrl: settings.baseUrl ?? undefined,
  };
}

export async function getSettings(): Promise<AppSettings | null> {
  const settings = await prisma.appSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  return settings ? mapPrismaSettings(settings) : null;
}

export async function saveSettings(
  data: Omit<AppSettings, "id" | "createdAt" | "updatedAt">
): Promise<ActionResult<AppSettings>> {
  return action(async () => {
    const existing = await prisma.appSettings.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    const prismaData = {
      ...data,
      apiKey: data.apiKey ?? null,
      baseUrl: data.baseUrl ?? null,
    };

    if (existing) {
      const updated = await prisma.appSettings.update({
        where: { id: existing.id },
        data: prismaData,
      });
      return mapPrismaSettings(updated);
    }

    const created = await prisma.appSettings.create({
      data: prismaData,
    });
    return mapPrismaSettings(created);
  });
}

export async function getEffectiveSettings(): Promise<AppSettings> {
  const settings = await getSettings();

  if (settings) {
    return settings;
  }

  return {
    id: "default",
    chatProvider: ChatProvider.OLLAMA,
    chatModel: process.env.OLLAMA_CHAT_MODEL || "llama3.2:3b",
    embeddingProvider: EmbeddingProvider.OLLAMA,
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",
    apiKey: undefined,
    baseUrl: undefined,
    language: Language.ES,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
