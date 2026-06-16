// @vitest-environment jsdom

import { describe, it, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import SettingsPage from "./page";
import { expectNoViolations } from "@/lib/test/a11y";

vi.mock("@/modules/settings/components/model-selector", () => ({
  ModelSelector: () => <div data-testid="model-selector" />,
}));

vi.mock("@/modules/settings/components/language-selector", () => ({
  LanguageSelector: () => <div data-testid="language-selector" />,
}));

vi.mock("@/lib/settings/actions", () => ({
  getEffectiveSettings: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => {
      const messages: Record<string, string> = {
        title: "Configuración",
        description: "Configura el modelo de IA",
        language: "Idioma",
        embeddingsTitle: "Sobre los embeddings",
        embeddingsDescription:
          "Los embeddings se generan siempre con el modelo nomic-embed-text de Ollama de forma local. Esto permite indexar documentos y recuperar contexto relevante sin depender de servicios externos.",
      };
      return messages[key] ?? key;
    })
  ),
}));

import { getEffectiveSettings } from "@/lib/settings/actions";

const mockGetEffectiveSettings = vi.mocked(getEffectiveSettings);

describe("SettingsPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders title, model selector, language selector and embeddings info", async () => {
    mockGetEffectiveSettings.mockResolvedValue({
      id: "settings-1",
      chatProvider: "ollama",
      chatModel: "llama3.2:3b",
      embeddingProvider: "ollama",
      embeddingModel: "nomic-embed-text",
      language: "es",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { container } = render(await SettingsPage());

    expect(
      screen.getByRole("heading", {
        name: /Configuración/i,
        level: 1,
      })
    ).toBeInTheDocument();
    expect(screen.getByTestId("model-selector")).toBeInTheDocument();
    expect(screen.getByTestId("language-selector")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Sobre los embeddings/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/nomic-embed-text/i)).toBeInTheDocument();

    await expectNoViolations(container);
  });
});
