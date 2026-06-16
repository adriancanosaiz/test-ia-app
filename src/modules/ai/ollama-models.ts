import { getOllamaBaseUrl } from "./provider";

export interface RecommendedModel {
  name: string;
  label: string;
  description: string;
  tags: string[];
  sizeGB?: number;
  minRamGB?: number;
}

const RECOMMENDED_MODELS: RecommendedModel[] = [
  {
    name: "llama3.2:1b",
    label: "Llama 3.2 1B",
    description: "Modelo ligero ideal para equipos con poca RAM.",
    tags: ["chat", "lightweight", "≤8 GB RAM"],
    sizeGB: 0.8,
    minRamGB: 4,
  },
  {
    name: "llama3.2:3b",
    label: "Llama 3.2 3B",
    description: "Equilibrio entre calidad y recursos para la mayoría de equipos.",
    tags: ["chat", "balanced", "≥8 GB RAM"],
    sizeGB: 2,
    minRamGB: 8,
  },
  {
    name: "qwen2.5:7b",
    label: "Qwen 2.5 7B",
    description: "Modelo potente con buen rendimiento en tareas complejas.",
    tags: ["chat", "powerful", "≥16 GB RAM"],
    sizeGB: 4.5,
    minRamGB: 16,
  },
  {
    name: "mistral:7b",
    label: "Mistral 7B",
    description: "Modelo potente y popular para chat de alta calidad.",
    tags: ["chat", "powerful", "≥16 GB RAM"],
    sizeGB: 4.1,
    minRamGB: 16,
  },
  {
    name: "gemma2:2b",
    label: "Gemma 2 2B",
    description: "Modelo ligero de Google para equipos modestos.",
    tags: ["chat", "lightweight", "≥6 GB RAM"],
    sizeGB: 1.6,
    minRamGB: 6,
  },
  {
    name: "phi3:3.8b",
    label: "Phi-3 3.8B",
    description: "Modelo equilibrado con buena calidad en hardware moderado.",
    tags: ["chat", "balanced", "≥8 GB RAM"],
    sizeGB: 2.3,
    minRamGB: 8,
  },
];

export async function listInstalledOllamaModels(
  baseUrl?: string
): Promise<string[]> {
  const resolvedBaseUrl = (baseUrl ?? getOllamaBaseUrl()).replace(/\/$/, "");

  try {
    const response = await fetch(`${resolvedBaseUrl}/api/tags`, {
      method: "GET",
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { models?: { name: string }[] };
    return data.models?.map((m) => m.name) ?? [];
  } catch {
    return [];
  }
}

export function getRecommendedModels(): RecommendedModel[] {
  return RECOMMENDED_MODELS.map((model) => ({ ...model }));
}

export function isModelInstalled(
  name: string,
  installed: string[]
): boolean {
  return installed.some(
    (installedName) =>
      installedName === name || installedName.startsWith(`${name}:`)
  );
}

export function recommendModelByRam(
  freeRamGB: number
): RecommendedModel {
  const sorted = [...RECOMMENDED_MODELS].sort(
    (a, b) => (a.minRamGB ?? 0) - (b.minRamGB ?? 0)
  );

  const candidates = sorted.filter(
    (model) => (model.minRamGB ?? 0) <= freeRamGB
  );

  if (candidates.length === 0) {
    return sorted[0];
  }

  return candidates[candidates.length - 1];
}
