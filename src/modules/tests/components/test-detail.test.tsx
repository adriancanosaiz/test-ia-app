// @vitest-environment jsdom

import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, act } from "@testing-library/react";
import { TestDetail, type TestDetailProps } from "./test-detail";
import { expectNoViolations } from "@/lib/test/a11y";
import { ToastProvider } from "@/hooks/use-toast";
import { retryGenerateTest } from "../actions";

let refreshMock: ReturnType<typeof vi.fn>;
let eventSourceListeners: Map<string, Array<(event: MessageEvent) => void>>;
const closeCalls: string[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
}));

vi.mock("../actions", () => ({
  retryGenerateTest: vi.fn(),
}));

const MockEventSource = vi.fn((url: string) => {
  eventSourceListeners = new Map();

  return {
    url,
    close: vi.fn(() => {
      closeCalls.push(url);
    }),
    addEventListener: vi.fn((event: string, handler: (e: MessageEvent) => void) => {
      if (!eventSourceListeners.has(event)) {
        eventSourceListeners.set(event, []);
      }
      eventSourceListeners.get(event)!.push(handler);
    }),
    removeEventListener: vi.fn(),
    onerror: null,
  };
});

const mockedRetryGenerateTest = vi.mocked(retryGenerateTest);

function emitProgress(data: unknown) {
  const listeners = eventSourceListeners.get("progress") ?? [];
  listeners.forEach((handler) => {
    handler(new MessageEvent("progress", { data: JSON.stringify(data) }));
  });
}

function renderWithProvider(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

function createTest(props: { status?: string; progress?: number; errorMessage?: string | null; questions?: TestDetailProps["test"]["questions"] } = {}) {
  return {
    id: "test-1",
    title: "Test de ejemplo",
    difficulty: "MEDIUM",
    questionType: "MULTIPLE_CHOICE",
    questionCount: 2,
    sourceLabel: "Documento",
    sourceName: "Apuntes",
    status: props.status ?? "PROCESSING",
    progress: props.progress ?? 10,
    errorMessage: props.errorMessage ?? null,
    questions: props.questions ?? [],
  };
}

describe("TestDetail", () => {
  beforeEach(() => {
    refreshMock = vi.fn();
    eventSourceListeners = new Map();
    closeCalls.length = 0;
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("muestra la barra de progreso mientras está en PROCESSING", () => {
    renderWithProvider(<TestDetail test={createTest({ progress: 25 })} />);

    expect(
      screen.getByText("Generando preguntas...")
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "25");
    expect(MockEventSource).toHaveBeenCalledWith("/api/tests/test-1/progress");
  });

  it("actualiza el progreso y refresca cuando llega a READY", async () => {
    renderWithProvider(<TestDetail test={createTest({ progress: 10 })} />);

    await act(async () => {
      emitProgress({ status: "PROCESSING", progress: 50, errorMessage: null });
    });

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toHaveAttribute("value", "50");
    });

    await act(async () => {
      emitProgress({ status: "READY", progress: 100, errorMessage: null });
    });

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });

    expect(closeCalls).toContain("/api/tests/test-1/progress");
  });

  it("refresca cuando el SSE notifica ERROR", async () => {
    renderWithProvider(<TestDetail test={createTest({ progress: 20 })} />);

    await act(async () => {
      emitProgress({
        status: "ERROR",
        progress: 30,
        errorMessage: "Fallo del modelo",
      });
    });

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });

    expect(closeCalls).toContain("/api/tests/test-1/progress");
  });

  it("muestra error y permite reintentar", async () => {
    mockedRetryGenerateTest.mockResolvedValue({
      success: true,
      data: { id: "test-1", status: "PROCESSING", progress: 0 },
    });

    renderWithProvider(
      <TestDetail
        test={createTest({
          status: "ERROR",
          progress: 0,
          errorMessage: "Fallo al generar",
        })}
      />
    );

    expect(screen.getByText("Fallo al generar")).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: "Reintentar" });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockedRetryGenerateTest).toHaveBeenCalledWith("test-1");
    });

    expect(refreshMock).toHaveBeenCalled();
  });

  it("notifica cuando el reintento falla", async () => {
    mockedRetryGenerateTest.mockResolvedValue({
      success: false,
      error: { type: "SYSTEM_ERROR", message: "No se pudo reintentar" },
    });

    renderWithProvider(
      <TestDetail
        test={createTest({
          status: "ERROR",
          progress: 0,
          errorMessage: "Fallo inicial",
        })}
      />
    );

    const retryButton = screen.getByRole("button", { name: "Reintentar" });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockedRetryGenerateTest).toHaveBeenCalledWith("test-1");
    });

    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("no tiene violaciones de accesibilidad", async () => {
    const { container } = renderWithProvider(
      <TestDetail test={createTest({ progress: 40 })} />
    );
    await expectNoViolations(container);
  });
});
