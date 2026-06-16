// @vitest-environment jsdom

import { describe, it, afterEach, vi, expect } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SummaryDetail } from "./summary-detail";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/toaster";
import { expectNoViolations } from "@/lib/test/a11y";

const mockRouterRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRouterRefresh,
  }),
}));

vi.mock("@/modules/summaries/actions", () => ({
  retrySummary: vi.fn(),
  generateSummary: vi.fn(),
}));

import { retrySummary } from "@/modules/summaries/actions";

const mockRetrySummary = vi.mocked(retrySummary);

let eventSourceInstances: MockEventSource[] = [];

class MockEventSource {
  listeners: Record<string, Array<(event: MessageEvent) => void>> = {};
  close = vi.fn();
  url: string;

  constructor(url: string) {
    this.url = url;
    eventSourceInstances.push(this);
  }

  addEventListener(type: string, handler: (event: MessageEvent) => void) {
    this.listeners[type] = this.listeners[type] ?? [];
    this.listeners[type].push(handler);
  }

  removeEventListener() {}

  emit(eventType: string, data: unknown) {
    const listeners = this.listeners[eventType] ?? [];
    listeners.forEach((handler) => {
      handler(new MessageEvent(eventType, { data: JSON.stringify(data) }));
    });
  }
}

vi.stubGlobal(
  "EventSource",
  MockEventSource as unknown as typeof EventSource
);

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <ToastProvider>
      {ui}
      <Toaster />
    </ToastProvider>
  );
}

function createProps(overrides: {
  status?: string;
  progress?: number;
  content?: string;
  errorMessage?: string | null;
}) {
  return {
    id: "summary-1",
    documentStatus: "READY",
    content: overrides.content ?? "",
    status: overrides.status ?? "READY",
    progress: overrides.progress ?? 0,
    errorMessage: overrides.errorMessage ?? null,
    createdAt: new Date("2026-06-13T10:00:00Z"),
  };
}

describe("SummaryDetail", () => {
  afterEach(() => {
    cleanup();
    eventSourceInstances = [];
    vi.clearAllMocks();
  });

  it("renderiza el contenido como markdown sanitizado", async () => {
    const props = createProps({
      status: "READY",
      content: "# Título\n\nPárrafo con **negrita**.",
      progress: 100,
    });
    const { container } = renderWithProvider(<SummaryDetail {...props} />);

    await waitFor(() => {
      expect(screen.getByText("Título")).toBeInTheDocument();
    });

    expect(screen.getByText(/Párrafo con/)).toBeInTheDocument();
    expect(screen.getByText("negrita")).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("muestra el mensaje de error real y un botón de reintento", async () => {
    const props = createProps({
      status: "ERROR",
      errorMessage: "Fallo de conexión con Ollama",
    });
    const { container } = renderWithProvider(<SummaryDetail {...props} />);

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(
      screen.getByText("Fallo de conexión con Ollama")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar generación del resumen" })
    ).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("deshabilita el reintento si el documento no está listo", async () => {
    const props = createProps({
      status: "ERROR",
      errorMessage: "Error",
    });
    props.documentStatus = "PROCESSING";

    const { container } = renderWithProvider(<SummaryDetail {...props} />);

    expect(
      screen.getByRole("button", { name: "Reintentar generación del resumen" })
    ).toBeDisabled();
    await expectNoViolations(container);
  });

  it("reintenta la generación del resumen", async () => {
    mockRetrySummary.mockResolvedValue({
      success: true,
      data: { summaryId: "summary-1" },
    });

    const props = createProps({
      status: "ERROR",
      errorMessage: "Error",
    });

    renderWithProvider(<SummaryDetail {...props} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Reintentar generación del resumen" })
    );

    await waitFor(() => {
      expect(mockRetrySummary).toHaveBeenCalledWith("summary-1");
    });

    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("muestra un toast si el reintento falla", async () => {
    mockRetrySummary.mockResolvedValue({
      success: false,
      error: { type: "USER_ERROR", message: "El documento no está listo" },
    });

    const props = createProps({
      status: "ERROR",
      errorMessage: "Error",
    });

    renderWithProvider(<SummaryDetail {...props} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Reintentar generación del resumen" })
    );

    await waitFor(() => {
      expect(screen.getByText("El documento no está listo")).toBeInTheDocument();
    });
  });

  it("abre un EventSource cuando el resumen está en proceso", async () => {
    const props = createProps({ status: "PROCESSING", progress: 10 });

    renderWithProvider(<SummaryDetail {...props} />);

    await waitFor(() => {
      expect(eventSourceInstances).toHaveLength(1);
    });

    expect(eventSourceInstances[0].url).toBe("/api/summaries/summary-1/progress");
  });

  it("actualiza el estado mediante SSE hasta READY", async () => {
    const props = createProps({
      status: "PROCESSING",
      progress: 10,
      content: "Resumen parcial.",
    });

    renderWithProvider(<SummaryDetail {...props} />);

    await waitFor(() => {
      expect(eventSourceInstances).toHaveLength(1);
    });

    eventSourceInstances[0].emit("progress", {
      status: "READY",
      progress: 100,
      errorMessage: null,
    });

    await waitFor(() => {
      expect(screen.getByText("Listo")).toBeInTheDocument();
    });

    expect(screen.getByText("Resumen parcial.")).toBeInTheDocument();
    expect(eventSourceInstances[0].close).toHaveBeenCalled();
  });

  it("muestra error real cuando SSE reporta ERROR", async () => {
    const props = createProps({ status: "PROCESSING", progress: 10 });

    renderWithProvider(<SummaryDetail {...props} />);

    await waitFor(() => {
      expect(eventSourceInstances).toHaveLength(1);
    });

    eventSourceInstances[0].emit("progress", {
      status: "ERROR",
      progress: 0,
      errorMessage: "Error del modelo",
    });

    await waitFor(() => {
      expect(screen.getByText("Error del modelo")).toBeInTheDocument();
    });

    expect(eventSourceInstances[0].close).toHaveBeenCalled();
  });
});
