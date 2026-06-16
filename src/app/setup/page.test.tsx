// @vitest-environment jsdom

import { describe, it, afterEach, vi, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import SetupPage from "./page";
import { expectNoViolations } from "@/lib/test/a11y";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("@/lib/settings/actions", () => ({
  getSettings: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => {
      const messages: Record<string, string> = {
        title: "Bienvenido a TestForge",
        setupDescription:
          "Para empezar, elige un modelo de IA que se instalará localmente con Ollama. Podrás cambiarlo más tarde desde Configuración.",
      };
      return messages[key] ?? key;
    })
  ),
}));

vi.mock("@/modules/settings/components/model-selector", () => ({
  ModelSelector: ({ onSaved }: { onSaved?: () => void }) => (
    <div data-testid="model-selector">
      {onSaved && (
        <button data-testid="trigger-saved" onClick={onSaved}>
          Guardar
        </button>
      )}
    </div>
  ),
}));

import { getSettings } from "@/lib/settings/actions";
import { redirect } from "next/navigation";

const mockGetSettings = vi.mocked(getSettings);
const mockRedirect = vi.mocked(redirect);

describe("SetupPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("redirects to /dashboard when settings already exist", async () => {
    mockGetSettings.mockResolvedValue({
      id: "settings-1",
      chatProvider: "ollama",
      chatModel: "llama3.2:3b",
      embeddingProvider: "ollama",
      embeddingModel: "nomic-embed-text",
      language: "es",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(SetupPage()).rejects.toThrow("REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("renders the wizard when there are no settings", async () => {
    mockGetSettings.mockResolvedValue(null);

    const { container } = render(await SetupPage());

    expect(
      screen.getByRole("heading", { name: /Bienvenido a TestForge/i, level: 1 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/elige un modelo de IA/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId("model-selector")).toBeInTheDocument();

    await expectNoViolations(container);
  });

  it("renders error state when getSettings fails", async () => {
    mockGetSettings.mockRejectedValue(new Error("DB error"));

    const { container } = render(await SetupPage());

    expect(
      screen.getByRole("heading", { name: /No se ha podido cargar el contenido/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reintentar/i })).toBeInTheDocument();

    await expectNoViolations(container);
  });
});
