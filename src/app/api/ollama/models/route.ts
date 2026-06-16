import { NextResponse } from "next/server";
import os from "os";
import {
  getRecommendedModels,
  listInstalledOllamaModels,
  recommendModelByRam,
  RecommendedModel,
} from "@/modules/ai/ollama-models";

export interface OllamaModelsResponse {
  installed: string[];
  recommended: RecommendedModel[];
  recommendedByHardware: RecommendedModel | null;
}

export async function GET(): Promise<NextResponse<OllamaModelsResponse>> {
  const installed = await listInstalledOllamaModels();
  const recommended = getRecommendedModels();

  let recommendedByHardware: RecommendedModel | null = null;

  try {
    const freeMemBytes = os.freemem();
    const freeRamGB = freeMemBytes / 1024 / 1024 / 1024;
    recommendedByHardware = recommendModelByRam(freeRamGB);
  } catch {
    recommendedByHardware = null;
  }

  return NextResponse.json({
    installed,
    recommended,
    recommendedByHardware,
  });
}
