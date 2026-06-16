// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModelSelector } from "./model-selector";
import { saveSettings } from "@/lib/settings/actions";
import { validateExternalProvider } from "@/lib/settings/validate-provider";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/toaster";
import { expectNoViolations } from "@/lib/test/a11y";
import type { RecommendedModel } from "@/modules/ai/ollama-models";
import type { OllamaModelsResponse } from "@/app/api/ollama/models/route";

vi.mock("@/lib/settings/actions", () => ({
  saveSettings: vi.fn(),
}));

vi.mock("@/lib/settings/validate-provider", () => ({
  validateExternalProvider: vi.fn(),
}));

const mockSaveSettings = vi.mocked(saveSettings);
const mockValidateExternalProvider = vi.mocked(validateExternalProvider);

const recommendedModels: RecommendedModel[] = [
  {
    name: "llama3.2:1b",
    label: "Llama 3.2 1B",
    description: "Modelo ligero.",
    tags: ["chat", "lightweight"],
    sizeGB: 0.8,
    minRamGB: 4,
  },
  {
    name: "llama3.2:3b",
    label: "Llama 3.2 3B",
    description: "Equilibrio calidad/recursos.",
    tags: ["chat", "balanced"],
    sizeGB: 2,
    minRamGB: 8,
  },
];

function createJsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => data,
  } as unknown as Response;
}

function createStreamResponse(lines: string[]) {
  const encoder = new TextEncoder();
  const chunks = lines.map((line) => encoder.encode(`${line}\n`));
  let index = 0;

  const reader = {
    read: vi.fn(async () => {
      if (index >= chunks.length) {
        return { done: true as const, value: undefined };
      }
      return { done: false as const, value: chunks[index++] };
    }),
    releaseLock: vi.fn(),
  };

  return {
    ok: true,
    status: 200,
    statusText: "OK",
    body: { getReader: () => reader },
  } as unknown as Response;
}

function createModelsResponse(
  partial: Partial<OllamaModelsResponse> = {}
): OllamaModelsResponse {
  return {
    installed: [],
    recommended: recommendedModels,
    recommendedByHardware: recommendedModels[1],
    ...partial,
  };
}

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <ToastProvider>
      {ui}
      <Toaster />
    </ToastProvider>
  );
}

async function getCardByModelName(name: string) {
  const heading = await screen.findByRole("heading", { name });
  return heading.closest('[data-slot="card"]') as HTMLElement;
}

describe("ModelSelector", () => {
  beforeEach(() => {
    mockSaveSettings.mockResolvedValue({
      success: true,
      data: {
        id: "settings-1",
        chatProvider: "openai",
        chatModel: "gpt-4o-mini",
        embeddingProvider: "ollama",
        embeddingModel: "nomic-embed-text",
        language: "es",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    mockValidateExternalProvider.mockResolvedValue({
      success: true,
      data: { ok: true },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("muestra el modelo recomendado por hardware y la lista de modelos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createJsonResponse(createModelsResponse()))
    );

    renderWithProvider(<ModelSelector />);

    expect(
      await screen.findByRole("heading", { name: "Recomendado para tu equipo" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Usar y descargar" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Llama 3.2 3B" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Llama 3.2 1B" })
    ).toBeInTheDocument();
  });

  it("descarga un modelo, guarda settings y llama a onSaved", async () => {
    const onSaved = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url).includes("/api/ollama/models")) {
          return createJsonResponse(createModelsResponse());
        }
        return createStreamResponse([
          JSON.stringify({
            status: "pulling manifest",
            completed: 0,
            total: 100,
          }),
          JSON.stringify({ status: "downloading", completed: 50, total: 100 }),
          JSON.stringify({ status: "success" }),
        ]);
      })
    );

    renderWithProvider(<ModelSelector onSaved={onSaved} />);

    const card = await getCardByModelName("Llama 3.2 1B");
    const downloadButton = within(card).getByRole("button", { name: "Descargar" });
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith({
        chatProvider: "ollama",
        chatModel: "llama3.2:1b",
        embeddingProvider: "ollama",
        embeddingModel: "nomic-embed-text",
        language: "es",
      });
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });

    expect(
      await screen.findByText(/se ha instalado y configurado/i)
    ).toBeInTheDocument();
  });

  it("muestra error si el stream de descarga devuelve un error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url).includes("/api/ollama/models")) {
          return createJsonResponse(createModelsResponse());
        }
        return createStreamResponse([
          JSON.stringify({ status: "error", error: "Fallo de red" }),
        ]);
      })
    );

    renderWithProvider(<ModelSelector />);

    const card = await getCardByModelName("Llama 3.2 1B");
    const downloadButton = within(card).getByRole("button", { name: "Descargar" });
    fireEvent.click(downloadButton);

    expect(await screen.findAllByText("Fallo de red")).toHaveLength(2);
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it("muestra 'Usar este modelo' si el modelo ya está instalado y guarda settings", async () => {
    const onSaved = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse(
          createModelsResponse({ installed: ["llama3.2:1b"] })
        )
      )
    );

    renderWithProvider(<ModelSelector onSaved={onSaved} />);

    const card = await getCardByModelName("Llama 3.2 1B");
    const useButton = within(card).getByRole("button", { name: "Usar este modelo" });
    fireEvent.click(useButton);

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith({
        chatProvider: "ollama",
        chatModel: "llama3.2:1b",
        embeddingProvider: "ollama",
        embeddingModel: "nomic-embed-text",
        language: "es",
      });
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("muestra las pestañas 'Ollama local' y 'API externa'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createJsonResponse(createModelsResponse()))
    );

    renderWithProvider(<ModelSelector />);

    expect(
      await screen.findByRole("tab", { name: "Ollama local" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "API externa" })
    ).toBeInTheDocument();
  });

  it("permite configurar un proveedor externo y probar la conexión", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createJsonResponse(createModelsResponse()))
    );

    renderWithProvider(<ModelSelector />);

    await userEvent.click(await screen.findByRole("tab", { name: "API externa" }));

    await waitFor(() => {
      expect(screen.getByLabelText(/API key/i)).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText(/API key/i), "sk-test");
    await userEvent.click(screen.getByRole("button", { name: "Probar conexión" }));

    await waitFor(() => {
      expect(mockValidateExternalProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "openai",
          apiKey: "sk-test",
          chatModel: "gpt-4o-mini",
        })
      );
    });

    expect(
      await screen.findByText(/Conexión exitosa/i)
    ).toBeInTheDocument();
  });

  it("guarda la configuración del proveedor externo", async () => {
    const onSaved = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createJsonResponse(createModelsResponse()))
    );

    renderWithProvider(<ModelSelector onSaved={onSaved} />);

    await userEvent.click(await screen.findByRole("tab", { name: "API externa" }));

    await waitFor(() => {
      expect(screen.getByLabelText(/API key/i)).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText(/API key/i), "sk-test");
    await userEvent.type(
      screen.getByLabelText(/URL base \(opcional\)/i),
      "https://custom.openai.com/v1"
    );
    await userEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith({
        chatProvider: "openai",
        chatModel: "gpt-4o-mini",
        embeddingProvider: "ollama",
        embeddingModel: "nomic-embed-text",
        apiKey: "sk-test",
        baseUrl: "https://custom.openai.com/v1",
        language: "es",
      });
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("muestra error si la validación del proveedor externo falla", async () => {
    mockValidateExternalProvider.mockResolvedValue({
      success: false,
      error: {
        type: "USER_ERROR",
        message: "API key inválida",
        code: "CONNECTION_ERROR",
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createJsonResponse(createModelsResponse()))
    );

    renderWithProvider(<ModelSelector />);

    await userEvent.click(await screen.findByRole("tab", { name: "API externa" }));

    await waitFor(() => {
      expect(screen.getByLabelText(/API key/i)).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText(/API key/i), "sk-test");
    await userEvent.click(screen.getByRole("button", { name: "Probar conexión" }));

    expect(await screen.findByText("API key inválida")).toBeInTheDocument();
  });

  it("no tiene violaciones de accesibilidad con ambas pestañas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createJsonResponse(createModelsResponse()))
    );

    const { baseElement } = renderWithProvider(<ModelSelector />);

    await screen.findByRole("tab", { name: "Ollama local" });
    await expectNoViolations(baseElement);

    await userEvent.click(screen.getByRole("tab", { name: "API externa" }));
    await waitFor(() => {
      expect(screen.getByLabelText(/API key/i)).toBeInTheDocument();
    });
    await expectNoViolations(baseElement);
  });
});
