// @vitest-environment jsdom

import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Chat } from "./chat";
import { ToastProvider } from "@/hooks/use-toast";
import { expectNoViolations } from "@/lib/test/a11y";
import type { ChatMessage } from "@prisma/client";

const mockRouterPush = vi.fn();
const mockRouterRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, refresh: mockRouterRefresh }),
}));

vi.mock("../actions", () => ({
  addUserMessage: vi.fn(),
  startChatResponse: vi.fn(),
  cancelChatResponse: vi.fn(),
  regenerateChatResponse: vi.fn(),
}));

import {
  addUserMessage,
  startChatResponse,
  cancelChatResponse,
  regenerateChatResponse,
} from "../actions";

const mockAddUserMessage = vi.mocked(addUserMessage);
const mockStartChatResponse = vi.mocked(startChatResponse);
const mockCancelChatResponse = vi.mocked(cancelChatResponse);
const mockRegenerateChatResponse = vi.mocked(regenerateChatResponse);

type EventSourceListener = (event: { data: string }) => void;

const eventSourceListeners: Record<string, Record<string, EventSourceListener[]>> =
  {};
const activeEventSources: { url: string; close: () => void }[] = [];

class MockEventSource {
  url: string;
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;

  constructor(url: string) {
    this.url = url;
    eventSourceListeners[url] = {};
    activeEventSources.push({ url, close: () => this.close() });
  }

  addEventListener(type: string, listener: EventSourceListener) {
    eventSourceListeners[this.url][type] ??= [];
    eventSourceListeners[this.url][type].push(listener);
  }

  removeEventListener() {
    // no-op for tests
  }

  close() {
    const index = activeEventSources.findIndex((es) => es.url === this.url);
    if (index > -1) {
      activeEventSources.splice(index, 1);
    }
  }
}

function emitProgress(url: string, data: unknown) {
  const payload = JSON.stringify(data);
  act(() => {
    eventSourceListeners[url]?.progress?.forEach((listener) =>
      listener({ data: payload })
    );
  });
}

function renderWithProvider(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("Chat", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", MockEventSource);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn() },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Object.keys(eventSourceListeners).forEach((key) => delete eventSourceListeners[key]);
    activeEventSources.length = 0;
  });

  it("has no accessibility violations", async () => {
    Element.prototype.scrollIntoView = vi.fn();

    const messages: ChatMessage[] = [];

    const { container } = renderWithProvider(
      <Chat sessionId="session-1" initialMessages={messages} hasIndexedDocuments />
    );

    await expectNoViolations(container);
  });

  it("has no accessibility violations with messages", async () => {
    Element.prototype.scrollIntoView = vi.fn();

    const messages: ChatMessage[] = [
      {
        id: "user-1",
        sessionId: "session-1",
        role: "user",
        content: "Hola",
        status: null,
        sources: null,
        createdAt: new Date(),
      },
      {
        id: "assistant-1",
        sessionId: "session-1",
        role: "assistant",
        content: "Respuesta con [1]",
        status: "READY",
        sources: [
          {
            documentId: "doc-1",
            documentTitle: "Apuntes",
            subjectName: "Asignatura",
            similarity: 0.9,
            pageNumber: 1,
          },
        ],
        createdAt: new Date(),
      },
    ];

    const { container } = renderWithProvider(
      <Chat sessionId="session-1" initialMessages={messages} />
    );

    await expectNoViolations(container);
  });

  it("abre un EventSource asociado al mensaje concreto en PROCESSING", () => {
    Element.prototype.scrollIntoView = vi.fn();

    const messages: ChatMessage[] = [
      {
        id: "user-1",
        sessionId: "session-1",
        role: "user",
        content: "Hola",
        status: null,
        sources: null,
        createdAt: new Date(),
      },
      {
        id: "assistant-1",
        sessionId: "session-1",
        role: "assistant",
        content: "",
        status: "PROCESSING",
        sources: null,
        createdAt: new Date(),
      },
    ];

    const { unmount } = renderWithProvider(
      <Chat sessionId="session-1" initialMessages={messages} />
    );

    expect(activeEventSources).toHaveLength(1);
    expect(activeEventSources[0].url).toBe(
      "/api/chat/session-1/progress?messageId=assistant-1"
    );

    unmount();
    expect(activeEventSources).toHaveLength(0);
  });

  it("muestra sugerencias en el empty state cuando hay documentos indexados", () => {
    Element.prototype.scrollIntoView = vi.fn();

    renderWithProvider(
      <Chat
        sessionId="session-1"
        initialMessages={[]}
        hasIndexedDocuments
      />
    );

    expect(
      screen.getByRole("button", {
        name: /Resume los puntos clave del temario/i,
      })
    ).toBeInTheDocument();
  });

  it("envía un mensaje y crea la burbuja del asistente en PROCESSING", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    mockAddUserMessage.mockResolvedValue({
      success: true,
      data: { sessionId: "session-1", sourceDocumentId: null },
    });
    mockStartChatResponse.mockResolvedValue({
      success: true,
      data: { assistantMessageId: "assistant-1" },
    });

    renderWithProvider(
      <Chat sessionId="session-1" initialMessages={[]} hasIndexedDocuments />
    );

    const textarea = screen.getByRole("textbox", {
      name: "Escribe tu pregunta",
    });
    await userEvent.type(textarea, "¿Qué es la fotosíntesis?");
    await userEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));

    await waitFor(() => {
      expect(mockAddUserMessage).toHaveBeenCalledWith(
        "session-1",
        "¿Qué es la fotosíntesis?",
        undefined
      );
    });

    await waitFor(() => {
      expect(mockStartChatResponse).toHaveBeenCalledWith("session-1");
    });

    await waitFor(() => {
      expect(activeEventSources[0].url).toBe(
        "/api/chat/session-1/progress?messageId=assistant-1"
      );
    });
  });

  it("actualiza el contenido del mensaje mediante SSE", async () => {
    Element.prototype.scrollIntoView = vi.fn();

    const messages: ChatMessage[] = [
      {
        id: "assistant-1",
        sessionId: "session-1",
        role: "assistant",
        content: "",
        status: "PROCESSING",
        sources: null,
        createdAt: new Date(),
      },
    ];

    renderWithProvider(
      <Chat sessionId="session-1" initialMessages={messages} />
    );

    const url = "/api/chat/session-1/progress?messageId=assistant-1";

    emitProgress(url, {
      id: "assistant-1",
      content: "Respuesta parcial",
      status: "PROCESSING",
      sources: null,
    });

    await waitFor(() => {
      expect(screen.getByText("Respuesta parcial")).toBeInTheDocument();
    });

    emitProgress(url, {
      id: "assistant-1",
      content: "Respuesta final",
      status: "READY",
      sources: null,
    });

    await waitFor(() => {
      expect(screen.getByText("Respuesta final")).toBeInTheDocument();
    });

    expect(activeEventSources).toHaveLength(0);
  });

  it("renderiza fuentes y convierte citas inline en enlaces", async () => {
    Element.prototype.scrollIntoView = vi.fn();

    const messages: ChatMessage[] = [
      {
        id: "assistant-1",
        sessionId: "session-1",
        role: "assistant",
        content: "Según la fuente [1], la respuesta es correcta.",
        status: "READY",
        sources: [
          {
            documentId: "doc-1",
            documentTitle: "Apuntes",
            subjectName: "Asignatura",
            similarity: 0.85,
            pageNumber: 2,
          },
        ],
        createdAt: new Date(),
      },
    ];

    renderWithProvider(
      <Chat sessionId="session-1" initialMessages={messages} />
    );

    await userEvent.click(screen.getByText(/Fuentes \(1\)/i));

    expect(screen.getByText(/Apuntes/)).toBeInTheDocument();
    expect(screen.getByText(/pág\. 2/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1" })).toHaveAttribute(
      "href",
      "#source-assistant-1-1"
    );
  });

  it("copia la respuesta al portapapeles", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const messages: ChatMessage[] = [
      {
        id: "assistant-1",
        sessionId: "session-1",
        role: "assistant",
        content: "Respuesta a copiar",
        status: "READY",
        sources: [],
        createdAt: new Date(),
      },
    ];

    renderWithProvider(
      <Chat sessionId="session-1" initialMessages={messages} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Copiar respuesta" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("Respuesta a copiar");
    });
  });

  it("cancela la generación en curso", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    mockCancelChatResponse.mockResolvedValue({ success: true, data: undefined });

    const messages: ChatMessage[] = [
      {
        id: "assistant-1",
        sessionId: "session-1",
        role: "assistant",
        content: "",
        status: "PROCESSING",
        sources: null,
        createdAt: new Date(),
      },
    ];

    renderWithProvider(
      <Chat sessionId="session-1" initialMessages={messages} />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Cancelar generación" })
    );

    await waitFor(() => {
      expect(mockCancelChatResponse).toHaveBeenCalledWith(
        "session-1",
        "assistant-1"
      );
    });

    expect(
      screen.getByText("Generación cancelada por el usuario.")
    ).toBeInTheDocument();
  });

  it("muestra error amigable y permite reintentar", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    mockRegenerateChatResponse.mockResolvedValue({
      success: true,
      data: undefined,
    });

    const messages: ChatMessage[] = [
      {
        id: "assistant-1",
        sessionId: "session-1",
        role: "assistant",
        content: "Ha ocurrido un error al generar la respuesta: Ollama no disponible",
        status: "ERROR",
        sources: null,
        createdAt: new Date(),
      },
    ];

    renderWithProvider(
      <Chat sessionId="session-1" initialMessages={messages} />
    );

    expect(
      screen.getByText("No se ha podido generar la respuesta.")
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(mockRegenerateChatResponse).toHaveBeenCalledWith(
        "session-1",
        "assistant-1"
      );
    });
  });
});
