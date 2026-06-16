// @vitest-environment jsdom

import { describe, it, vi, afterEach, expect } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentList } from "./document-list";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/toaster";
import { expectNoViolations } from "@/lib/test/a11y";

const mockRouterRefresh = vi.fn();
const mockRouter = { push: vi.fn(), refresh: mockRouterRefresh };

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("../actions", () => ({
  updateDocumentTitle: vi.fn(),
  deleteDocument: vi.fn(),
  processDocument: vi.fn(),
  cancelDocumentProcessing: vi.fn(),
}));

import {
  updateDocumentTitle,
  deleteDocument,
  processDocument,
  cancelDocumentProcessing,
} from "../actions";

const mockUpdateTitle = vi.mocked(updateDocumentTitle);
const mockDeleteDocument = vi.mocked(deleteDocument);
const mockProcessDocument = vi.mocked(processDocument);
const mockCancelDocumentProcessing = vi.mocked(cancelDocumentProcessing);

class MockEventSource {
  url = "";
  listeners: Record<string, ((event: MessageEvent) => void)[]> = {};
  closed = false;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, handler: (event: MessageEvent) => void) {
    this.listeners[type] = this.listeners[type] ?? [];
    this.listeners[type].push(handler);
  }

  removeEventListener() {}

  dispatch(type: string, data: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    (this.listeners[type] ?? []).forEach((handler) => handler(event));
  }

  close() {
    this.closed = true;
  }
}

let activeEventSource: MockEventSource | null = null;

vi.stubGlobal(
  "EventSource",
  vi.fn((url: string) => {
    activeEventSource = new MockEventSource(url);
    return activeEventSource;
  })
);

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <ToastProvider>
      {ui}
      <Toaster />
    </ToastProvider>
  );
}

const sampleDoc = {
  id: "doc-1",
  title: "Apuntes iniciales",
  fileName: "apuntes.txt",
  mimeType: "text/plain",
  status: "READY" as const,
  errorMessage: null,
  chunkCount: 5,
  progress: 100,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const processingDoc = {
  id: "doc-2",
  title: "Documento en proceso",
  fileName: "proceso.txt",
  mimeType: "text/plain",
  status: "PROCESSING" as const,
  errorMessage: null,
  chunkCount: 0,
  progress: 10,
  createdAt: new Date("2024-01-02"),
  updatedAt: new Date("2024-01-02"),
};

const errorDoc = {
  id: "doc-3",
  title: "Documento con error",
  fileName: "error.txt",
  mimeType: "text/plain",
  status: "ERROR" as const,
  errorMessage: "Error de procesamiento",
  chunkCount: 0,
  progress: 0,
  createdAt: new Date("2024-01-03"),
  updatedAt: new Date("2024-01-03"),
};

describe("DocumentList", () => {
  afterEach(() => {
    cleanup();
    // Limpiar portales y estilos residuales de componentes con @base-ui/react
    // (diálogos, selects, etc.) que testing-library no elimina por completo.
    document.body.innerHTML = "";
    document.body.removeAttribute("style");
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("muestra empty state accesible cuando no hay documentos", async () => {
    const { container } = renderWithProvider(<DocumentList documents={[]} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("No hay documentos todavía")).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("permite editar el título con Enter", async () => {
    mockUpdateTitle.mockResolvedValue({
      success: true,
      data: { id: "doc-1", title: "Apuntes actualizados" },
    });

    renderWithProvider(<DocumentList documents={[sampleDoc]} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Editar título de Apuntes iniciales" })
    );

    const input = screen.getByLabelText("Editar título del documento");
    await userEvent.clear(input);
    await userEvent.type(input, "Apuntes actualizados");
    await userEvent.keyboard("{Enter}");

    expect(mockUpdateTitle).toHaveBeenCalledWith("doc-1", "Apuntes actualizados");
  });

  it("cancela la edición con Escape", async () => {
    mockUpdateTitle.mockResolvedValue({
      success: true,
      data: { id: "doc-1", title: "Apuntes iniciales" },
    });

    renderWithProvider(<DocumentList documents={[sampleDoc]} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Editar título de Apuntes iniciales" })
    );

    const input = screen.getByLabelText("Editar título del documento");
    await userEvent.clear(input);
    await userEvent.type(input, "Cambio descartado");
    await userEvent.keyboard("{Escape}");

    expect(mockUpdateTitle).not.toHaveBeenCalled();
    expect(screen.getByText("Apuntes iniciales")).toBeInTheDocument();
  });

  it("muestra un toast al fallar el guardado", async () => {
    mockUpdateTitle.mockResolvedValue({
      success: false,
      error: { type: "SYSTEM_ERROR", message: "Error de conexión" },
    });

    renderWithProvider(<DocumentList documents={[sampleDoc]} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Editar título de Apuntes iniciales" })
    );

    const input = screen.getByLabelText("Editar título del documento");
    await userEvent.clear(input);
    await userEvent.type(input, "Nuevo título");
    fireEvent.blur(input);

    expect(await screen.findByText("Error de conexión")).toBeInTheDocument();
  });

  it("abre el diálogo de confirmación al pulsar eliminar", async () => {
    const { baseElement } = renderWithProvider(
      <DocumentList documents={[sampleDoc]} />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar documento Apuntes iniciales" })
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await expectNoViolations(baseElement);
  });

  it("elimina el documento al confirmar", async () => {
    mockDeleteDocument.mockResolvedValue({
      success: true,
      data: { subjectId: "subject-1" },
    });

    renderWithProvider(<DocumentList documents={[sampleDoc]} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar documento Apuntes iniciales" })
    );

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(mockDeleteDocument).toHaveBeenCalledWith("doc-1");
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("muestra un toast si la eliminación falla", async () => {
    mockDeleteDocument.mockResolvedValue({
      success: false,
      error: { type: "SYSTEM_ERROR", message: "Error de conexión" },
    });

    renderWithProvider(<DocumentList documents={[sampleDoc]} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar documento Apuntes iniciales" })
    );

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(screen.getByText("Error de conexión")).toBeInTheDocument();
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("muestra barra de progreso y conecta SSE cuando está procesando", async () => {
    renderWithProvider(<DocumentList documents={[processingDoc]} />);

    expect(
      screen.getByLabelText(/Progreso de procesamiento/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(activeEventSource?.url).toBe("/api/documents/doc-2/progress");
    });

    act(() => {
      activeEventSource?.dispatch("progress", {
        status: "PROCESSING",
        progress: 50,
        errorMessage: null,
      });
    });

    await waitFor(() => {
      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    act(() => {
      activeEventSource?.dispatch("progress", {
        status: "READY",
        progress: 100,
        errorMessage: null,
      });
    });

    await waitFor(() => {
      expect(activeEventSource?.closed).toBe(true);
      expect(screen.getByText(/Indexado/)).toBeInTheDocument();
    });
  });

  it("permite cancelar el procesamiento", async () => {
    mockCancelDocumentProcessing.mockResolvedValue({ success: true, data: undefined });

    renderWithProvider(<DocumentList documents={[processingDoc]} />);

    await waitFor(() => {
      expect(activeEventSource?.url).toBe("/api/documents/doc-2/progress");
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Cancelar procesamiento/i })
    );

    await waitFor(() => {
      expect(mockCancelDocumentProcessing).toHaveBeenCalledWith("doc-2");
    });

    expect(activeEventSource?.closed).toBe(true);
    expect(
      screen.getByRole("button", { name: /Reintentar procesar documento/i })
    ).toBeInTheDocument();
  });

  it("reconecta SSE tras un error con backoff exponencial", async () => {
    renderWithProvider(<DocumentList documents={[processingDoc]} />);

    await waitFor(() => {
      expect(activeEventSource?.url).toBe("/api/documents/doc-2/progress");
    });

    const firstEventSource = activeEventSource;

    act(() => {
      firstEventSource?.dispatch("error", {});
    });

    expect(firstEventSource?.closed).toBe(true);

    // Antes del backoff inicial (1 s) no debe reconectar
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(activeEventSource).toBe(firstEventSource);

    // Tras el backoff se crea una nueva conexión
    await waitFor(
      () => {
        expect(activeEventSource).not.toBe(firstEventSource);
        expect(activeEventSource?.url).toBe("/api/documents/doc-2/progress");
      },
      { timeout: 3000 }
    );
  });

  it("muestra error del servidor sin reconectar cuando recibe evento error", async () => {
    renderWithProvider(<DocumentList documents={[processingDoc]} />);

    await waitFor(() => {
      expect(activeEventSource?.url).toBe("/api/documents/doc-2/progress");
    });

    act(() => {
      activeEventSource?.dispatch("error", { message: "Error del modelo" });
    });

    await waitFor(() => {
      expect(activeEventSource?.closed).toBe(true);
      expect(screen.getByText("Error del modelo")).toBeInTheDocument();
    });

    // No debe reconectar tras un error del servidor
    const eventSourceAfterError = activeEventSource;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(activeEventSource).toBe(eventSourceAfterError);
  });

  it("permite reintentar un documento en error", async () => {
    mockProcessDocument.mockResolvedValue({
      success: true,
      data: { id: "doc-3", status: "PROCESSING" },
    });

    renderWithProvider(<DocumentList documents={[errorDoc]} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Reintentar procesar documento/i })
    );

    await waitFor(() => {
      expect(mockProcessDocument).toHaveBeenCalledWith("doc-3");
    });

    await waitFor(() => {
      expect(screen.getByText(/Progreso de procesamiento/i)).toBeInTheDocument();
    });
  });

  it("filtra documentos por título", async () => {
    renderWithProvider(
      <DocumentList documents={[sampleDoc, processingDoc, errorDoc]} />
    );

    const input = screen.getByLabelText("Buscar documentos por título");
    await userEvent.type(input, "error");

    await waitFor(() => {
      expect(screen.getByText("Documento con error")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Apuntes iniciales")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Documento en proceso")
    ).not.toBeInTheDocument();
  });

  it("filtra documentos por estado", async () => {
    renderWithProvider(
      <DocumentList documents={[sampleDoc, processingDoc, errorDoc]} />
    );

    const trigger = screen.getByRole("combobox", { name: /Estado/i });
    act(() => {
      trigger.focus();
    });
    await userEvent.keyboard("{Enter}");

    const errorOption = await screen.findByRole("option", { name: "Error" });
    await userEvent.click(errorOption);

    await waitFor(() => {
      expect(screen.getByText("Documento con error")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Apuntes iniciales")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Documento en proceso")
    ).not.toBeInTheDocument();
  });
});
