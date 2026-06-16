// @vitest-environment jsdom

import { describe, it, vi, afterEach, expect } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSessionList } from "./chat-session-list";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/toaster";
import { expectNoViolations } from "@/lib/test/a11y";

const mockRouterPush = vi.fn();
const mockRouterRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, refresh: mockRouterRefresh }),
}));

vi.mock("../actions", () => ({
  deleteChatSession: vi.fn(),
}));

import { deleteChatSession } from "../actions";

const mockDeleteChatSession = vi.mocked(deleteChatSession);

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <ToastProvider>
      {ui}
      <Toaster />
    </ToastProvider>
  );
}

const sampleSessions = [
  {
    id: "session-1",
    title: "Conversación de prueba",
    sourceDocument: { title: "Documento" },
    _count: { messages: 3 },
    updatedAt: new Date("2026-06-13T10:00:00Z"),
  },
];

const sampleDocuments = [
  {
    id: "doc-1",
    title: "Apuntes",
    subject: { name: "Asignatura", folder: { name: "Carpeta" } },
  },
];

describe("ChatSessionList", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("muestra empty state accesible con CTA cuando no hay conversaciones", async () => {
    const { container } = renderWithProvider(
      <ChatSessionList sessions={[]} documents={sampleDocuments} />
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("No hay conversaciones")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nueva conversación" })
    ).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithProvider(
      <ChatSessionList sessions={sampleSessions} />
    );
    await expectNoViolations(container);
  });

  it("abre el diálogo de confirmación al pulsar eliminar", async () => {
    const { baseElement } = renderWithProvider(
      <ChatSessionList sessions={sampleSessions} />
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Eliminar conversación Conversación de prueba",
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await expectNoViolations(baseElement);
  });

  it("elimina la conversación al confirmar", async () => {
    mockDeleteChatSession.mockResolvedValue({
      success: true,
      data: { id: "session-1" },
    });

    renderWithProvider(<ChatSessionList sessions={sampleSessions} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: "Eliminar conversación Conversación de prueba",
      })
    );

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(mockDeleteChatSession).toHaveBeenCalledWith("session-1");
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(mockRouterPush).toHaveBeenCalledWith("/chat");
    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("muestra un toast si la eliminación falla", async () => {
    mockDeleteChatSession.mockResolvedValue({
      success: false,
      error: { type: "SYSTEM_ERROR", message: "Error de conexión" },
    });

    renderWithProvider(<ChatSessionList sessions={sampleSessions} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: "Eliminar conversación Conversación de prueba",
      })
    );

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(screen.getByText("Error de conexión")).toBeInTheDocument();
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
