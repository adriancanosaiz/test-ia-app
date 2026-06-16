// @vitest-environment jsdom

import { describe, it, afterEach, vi, expect } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SummaryList } from "./summary-list";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/toaster";
import { expectNoViolations } from "@/lib/test/a11y";

const mockRouterPush = vi.fn();
const mockRouterRefresh = vi.fn();
const mockEventSourceClose = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    refresh: mockRouterRefresh,
  }),
}));

class MockEventSource {
  listeners: Record<string, Array<(event: MessageEvent) => void>> = {};
  close = mockEventSourceClose;

  constructor() {
    setTimeout(() => {
      const listeners = this.listeners["progress"] ?? [];
      listeners.forEach((handler) => {
        handler(
          new MessageEvent("progress", {
            data: JSON.stringify({
              status: "PROCESSING",
              progress: 50,
              errorMessage: null,
            }),
          })
        );
      });
    }, 0);
  }

  addEventListener(type: string, handler: (event: MessageEvent) => void) {
    this.listeners[type] = this.listeners[type] ?? [];
    this.listeners[type].push(handler);
  }

  removeEventListener() {}
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

vi.mock("@/modules/summaries/actions", () => ({
  deleteSummary: vi.fn(),
  generateSummary: vi.fn(),
}));

import { deleteSummary, generateSummary } from "@/modules/summaries/actions";

const mockDeleteSummary = vi.mocked(deleteSummary);
const mockGenerateSummary = vi.mocked(generateSummary);

function createSummary(overrides: {
  id?: string;
  status?: string;
  progress?: number;
  content?: string;
  errorMessage?: string | null;
  createdAt?: Date;
}) {
  return {
    id: overrides.id ?? "summary-1",
    content: overrides.content ?? "Contenido del resumen.",
    status: overrides.status ?? "READY",
    progress: overrides.progress ?? 100,
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-06-13T10:00:00Z"),
  };
}

describe("SummaryList", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("muestra estado vacío con CTA cuando no hay resúmenes", async () => {
    const { container } = renderWithProvider(
      <SummaryList
        documentId="doc-1"
        documentStatus="READY"
        summaries={[]}
      />
    );

    expect(screen.getByText("No hay resúmenes todavía")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generar resumen" })
    ).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("deshabilita el CTA del estado vacío si el documento no está listo", async () => {
    renderWithProvider(
      <SummaryList
        documentId="doc-1"
        documentStatus="PROCESSING"
        summaries={[]}
      />
    );

    expect(
      screen.getByRole("button", { name: "Generar resumen" })
    ).toBeDisabled();
  });

  it("genera un resumen desde el estado vacío", async () => {
    mockGenerateSummary.mockResolvedValue({
      success: true,
      data: { summaryId: "summary-new" },
    });

    renderWithProvider(
      <SummaryList documentId="doc-1" documentStatus="READY" summaries={[]} />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Generar resumen" })
    );

    await waitFor(() => {
      expect(mockGenerateSummary).toHaveBeenCalledWith("doc-1");
    });

    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("renderiza un resumen listo con botón para ver y eliminar", async () => {
    const summary = createSummary({ status: "READY" });
    const { container } = renderWithProvider(
      <SummaryList
        documentId="doc-1"
        documentStatus="READY"
        summaries={[summary]}
      />
    );

    expect(screen.getByText("Listo")).toBeInTheDocument();
    expect(screen.getByText("Ver resumen")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Eliminar resumen" })
    ).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("renderiza un resumen en proceso con barra de progreso", async () => {
    const summary = createSummary({ status: "PROCESSING", progress: 50 });
    const { container } = renderWithProvider(
      <SummaryList
        documentId="doc-1"
        documentStatus="READY"
        summaries={[summary]}
      />
    );

    expect(screen.getByText("Generando")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Progreso de generación")
    ).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("renderiza un resumen con error", async () => {
    const summary = createSummary({
      status: "ERROR",
      errorMessage: "Fallo de conexión",
    });
    const { container } = renderWithProvider(
      <SummaryList
        documentId="doc-1"
        documentStatus="READY"
        summaries={[summary]}
      />
    );

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Fallo de conexión")).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("abre el diálogo de confirmación al pulsar eliminar", async () => {
    const summary = createSummary({ status: "READY" });
    const { baseElement } = renderWithProvider(
      <SummaryList
        documentId="doc-1"
        documentStatus="READY"
        summaries={[summary]}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar resumen" })
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await expectNoViolations(baseElement);
  });

  it("elimina el resumen al confirmar", async () => {
    mockDeleteSummary.mockResolvedValue({
      success: true,
      data: { documentId: "doc-1", subjectId: "subject-1" },
    });

    const summary = createSummary({ status: "READY" });
    renderWithProvider(
      <SummaryList
        documentId="doc-1"
        documentStatus="READY"
        summaries={[summary]}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar resumen" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(mockDeleteSummary).toHaveBeenCalledWith("summary-1");
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("muestra un toast si la eliminación falla", async () => {
    mockDeleteSummary.mockResolvedValue({
      success: false,
      error: { type: "SYSTEM_ERROR", message: "Error de conexión" },
    });

    const summary = createSummary({ status: "READY" });
    renderWithProvider(
      <SummaryList
        documentId="doc-1"
        documentStatus="READY"
        summaries={[summary]}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar resumen" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(screen.getByText("Error de conexión")).toBeInTheDocument();
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
