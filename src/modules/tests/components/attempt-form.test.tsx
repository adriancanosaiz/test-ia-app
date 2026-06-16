// @vitest-environment jsdom

import { describe, it, vi, afterEach, expect } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttemptForm } from "./attempt-form";
import { expectNoViolations } from "@/lib/test/a11y";

const mockRouterPush = vi.fn();
const mockRouterRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, refresh: mockRouterRefresh }),
}));

vi.mock("../actions", () => ({
  createAttempt: vi.fn(),
}));

import { createAttempt } from "../actions";

const mockCreateAttempt = vi.mocked(createAttempt);

const questions = [
  {
    id: "q1",
    type: "MULTIPLE_CHOICE",
    content: "¿Cuál es la capital de España?",
    options: [
      { id: "o1", text: "Madrid", index: 0 },
      { id: "o2", text: "Barcelona", index: 1 },
    ],
  },
];

describe("AttemptForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <AttemptForm testId="test-1" questions={questions} />
    );
    expect(screen.getByRole("radio", { name: "Madrid" })).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("muestra el diálogo de confirmación si hay preguntas sin responder", async () => {
    const { baseElement } = render(
      <main>
        <AttemptForm testId="test-1" questions={questions} />
      </main>
    );

    await userEvent.click(screen.getByRole("button", { name: "Finalizar test" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    expect(screen.getByText(/1 pregunta sin responder/i)).toBeInTheDocument();

    await expectNoViolations(baseElement);
  });

  it("envía el intento al confirmar el diálogo", async () => {
    mockCreateAttempt.mockResolvedValue({
      success: true,
      data: { id: "attempt-1", score: 0 },
    });

    render(<AttemptForm testId="test-1" questions={questions} />);

    await userEvent.click(screen.getByRole("button", { name: "Finalizar test" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar igualmente" })
    );

    await waitFor(() => {
      expect(mockCreateAttempt).toHaveBeenCalledWith("test-1", [
        {
          questionId: "q1",
          selectedOptionId: undefined,
          booleanAnswer: undefined,
          textAnswer: undefined,
        },
      ]);
    });

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/tests/test-1/attempts/attempt-1"
    );
    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("cierra el diálogo al pulsar cancelar", async () => {
    render(<AttemptForm testId="test-1" questions={questions} />);

    await userEvent.click(screen.getByRole("button", { name: "Finalizar test" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Seguir respondiendo" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(mockCreateAttempt).not.toHaveBeenCalled();
  });

  it("muestra el error inline si falla el envío", async () => {
    mockCreateAttempt.mockResolvedValue({
      success: false,
      error: { type: "USER_ERROR", message: "Error al crear intento" },
    });

    render(<AttemptForm testId="test-1" questions={questions} />);

    await userEvent.click(screen.getByRole("button", { name: "Finalizar test" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar igualmente" })
    );

    await waitFor(() => {
      expect(screen.getByText("Error al crear intento")).toBeInTheDocument();
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("persiste el borrador en localStorage al responder", async () => {
    render(<AttemptForm testId="test-1" questions={questions} />);

    await userEvent.click(screen.getByRole("radio", { name: "Madrid" }));

    await waitFor(() => {
      const saved = localStorage.getItem("test-attempt-draft:test-1");
      expect(saved).not.toBeNull();
      const parsed = JSON.parse(saved!);
      expect(parsed.q1.selectedOptionId).toBe("o1");
    });
  });

  it("carga el borrador desde localStorage", () => {
    localStorage.setItem(
      "test-attempt-draft:test-1",
      JSON.stringify({
        q1: { questionId: "q1", selectedOptionId: "o2" },
      })
    );

    render(<AttemptForm testId="test-1" questions={questions} />);

    expect(screen.getByRole("radio", { name: "Barcelona" })).toBeChecked();
  });

  it("muestra el temporizador y envía automáticamente al agotarse", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockCreateAttempt.mockResolvedValue({
      success: true,
      data: { id: "attempt-1", score: 0 },
    });

    render(
      <AttemptForm testId="test-1" questions={questions} timeLimitMinutes={0.05} />
    );

    await waitFor(() => {
      expect(screen.getByRole("timer")).toHaveTextContent("00:03");
    });

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    await waitFor(() => {
      expect(mockCreateAttempt).toHaveBeenCalled();
    });

    vi.useRealTimers();
  });
});
