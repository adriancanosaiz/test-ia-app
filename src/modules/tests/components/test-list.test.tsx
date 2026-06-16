// @vitest-environment jsdom

import { describe, it, vi, afterEach, expect } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestList } from "./test-list";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/toaster";
import { expectNoViolations } from "@/lib/test/a11y";

const mockRouterRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRouterRefresh }),
}));

vi.mock("../actions", () => ({
  deleteTest: vi.fn(),
}));

import { deleteTest } from "../actions";

const mockDeleteTest = vi.mocked(deleteTest);

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <ToastProvider>
      {ui}
      <Toaster />
    </ToastProvider>
  );
}

const sampleTests = [
  {
    id: "test-1",
    title: "Test de prueba",
    difficulty: "EASY",
    questionType: "MULTIPLE_CHOICE",
    questionCount: 5,
    sourceLabel: "Documento",
    sourceName: "Apuntes",
    status: "READY",
    createdAt: new Date("2026-06-01T10:00:00.000Z"),
    updatedAt: new Date("2026-06-01T10:00:00.000Z"),
    _count: { attempts: 0 },
  },
  {
    id: "test-2",
    title: "Otro test",
    difficulty: "MEDIUM",
    questionType: "TRUE_FALSE",
    questionCount: 3,
    sourceLabel: "Asignatura",
    sourceName: "Matemáticas",
    status: "PROCESSING",
    createdAt: new Date("2026-06-02T10:00:00.000Z"),
    updatedAt: new Date("2026-06-02T10:00:00.000Z"),
    _count: { attempts: 0 },
  },
];

describe("TestList", () => {
  afterEach(() => {
    cleanup();
    // Limpiar portales y estilos residuales de componentes con @base-ui/react
    // (diálogos, selects, etc.) que testing-library no elimina por completo.
    document.body.innerHTML = "";
    document.body.removeAttribute("style");
    vi.clearAllMocks();
  });

  it("muestra empty state accesible cuando no hay tests", async () => {
    const { container } = renderWithProvider(<TestList tests={[]} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("No hay tests todavía")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nuevo test" })
    ).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithProvider(
      <TestList tests={sampleTests} />
    );
    await expectNoViolations(container);
  });

  it("abre el diálogo de confirmación al pulsar eliminar", async () => {
    const { baseElement } = renderWithProvider(
      <TestList tests={sampleTests} />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar test Test de prueba" })
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await expectNoViolations(baseElement);
  });

  it("elimina el test al confirmar", async () => {
    mockDeleteTest.mockResolvedValue({
      success: true,
      data: { id: "test-1" },
    });

    renderWithProvider(<TestList tests={sampleTests} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar test Test de prueba" })
    );

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(mockDeleteTest).toHaveBeenCalledWith("test-1");
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("muestra un toast si la eliminación falla", async () => {
    mockDeleteTest.mockResolvedValue({
      success: false,
      error: { type: "SYSTEM_ERROR", message: "Error de conexión" },
    });

    renderWithProvider(<TestList tests={sampleTests} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar test Test de prueba" })
    );

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(screen.getByText("Error de conexión")).toBeInTheDocument();
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("filtra tests por título", async () => {
    renderWithProvider(<TestList tests={sampleTests} />);

    const input = screen.getByLabelText("Buscar tests por título");
    await userEvent.type(input, "Otro");

    await waitFor(() => {
      expect(screen.getByText("Otro test")).toBeInTheDocument();
    });

    expect(screen.queryByText("Test de prueba")).not.toBeInTheDocument();
  });

  it("filtra tests por estado", async () => {
    renderWithProvider(<TestList tests={sampleTests} />);

    const trigger = screen.getByRole("combobox", { name: /Estado/i });
    act(() => {
      trigger.focus();
    });
    await userEvent.keyboard("{Enter}");

    const processingOption = await screen.findByRole("option", { name: "Procesando" });
    await userEvent.click(processingOption);

    await waitFor(() => {
      expect(screen.getByText("Otro test")).toBeInTheDocument();
    });

    expect(screen.queryByText("Test de prueba")).not.toBeInTheDocument();
  });
});
