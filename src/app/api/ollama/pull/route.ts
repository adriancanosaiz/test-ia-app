import { NextRequest, NextResponse } from "next/server";
import { getOllamaBaseUrl } from "@/modules/ai/provider";
import { getRecommendedModels } from "@/modules/ai/ollama-models";

interface PullRequestBody {
  model?: unknown;
}

const OLLAMA_MODEL_NAME_REGEX = /^[a-zA-Z0-9._-]+(:[a-zA-Z0-9._-]+)?$/;

function isValidOllamaModelName(model: string): boolean {
  return OLLAMA_MODEL_NAME_REGEX.test(model);
}

function isRecommendedModel(model: string): boolean {
  const recommended = getRecommendedModels();
  return recommended.some((m) => m.name === model);
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: PullRequestBody;

  try {
    body = (await request.json()) as PullRequestBody;
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la petición no es un JSON válido." },
      { status: 400 }
    );
  }

  const { model } = body;

  if (typeof model !== "string" || model.trim() === "") {
    return NextResponse.json(
      { error: "El campo 'model' es obligatorio y debe ser un string no vacío." },
      { status: 400 }
    );
  }

  const trimmedModel = model.trim();

  if (!isRecommendedModel(trimmedModel) && !isValidOllamaModelName(trimmedModel)) {
    return NextResponse.json(
      { error: `El modelo '${trimmedModel}' no es un nombre válido de Ollama.` },
      { status: 400 }
    );
  }

  const baseUrl = getOllamaBaseUrl();

  try {
    const ollamaResponse = await fetch(`${baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmedModel, stream: true }),
    });

    if (!ollamaResponse.body) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                status: "error",
                error: "Ollama devolvió una respuesta vacía.",
              }) + "\n"
            )
          );
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { "Content-Type": "application/x-ndjson" },
      });
    }

    return new Response(ollamaResponse.body, {
      headers: { "Content-Type": "application/x-ndjson" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al conectar con Ollama";
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ status: "error", error: message }) + "\n"
          )
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson" },
    });
  }
}
