// @vitest-environment jsdom

import { describe, it, vi, afterEach, beforeEach, expect } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { AttemptDetail } from "./attempt-detail";
import { expectNoViolations } from "@/lib/test/a11y";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/toaster";

vi.mock("../actions", () => ({
  gradeShortAnswer: vi.fn(),
}));

import { gradeShortAnswer } from "../actions";

const mockGradeShortAnswer = vi.mocked(gradeShortAnswer);

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <ToastProvider>
      {ui}
      <Toaster />
    </ToastProvider>
  );
}

function createAttempt(overrides: {
  score?: number | null;
  answers?: {
    id: string;
    questionId: string;
    selectedOptionId: string | null;
    booleanAnswer: boolean | null;
    textAnswer: string | null;
    isCorrect: boolean | null;
  }[];
} = {}) {
  return {
    id: "attempt-1",
    score: overrides.score ?? null,
    startedAt: new Date("2024-01-01T10:00:00"),
    finishedAt: new Date("2024-01-01T10:05:00"),
    test: {
      id: "test-1",
      title: "Test de ejemplo",
      questions: [
        {
          id: "q1",
          content: "Capital de España",
          type: "SHORT_ANSWER",
          explanation: null,
          isCorrect: null,
          modelAnswer: "Madrid",
          options: [],
        },
      ],
    },
    answers:
      overrides.answers ?? [
        {
          id: "a1",
          questionId: "q1",
          selectedOptionId: null,
          booleanAnswer: null,
          textAnswer: "Madrid",
          isCorrect: null,
        },
      ],
  };
}

describe("AttemptDetail", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithProvider(
      <AttemptDetail attempt={createAttempt()} />
    );
    await expectNoViolations(container);
  });

  it("muestra los botones de corrección para respuestas cortas", () => {
    renderWithProvider(<AttemptDetail attempt={createAttempt()} />);

    expect(
      screen.getByRole("button", { name: /Marcar respuesta corta como correcta/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Marcar respuesta corta como incorrecta/i })
    ).toBeInTheDocument();
  });

  it("califica una respuesta corta como correcta y actualiza la nota", async () => {
    mockGradeShortAnswer.mockResolvedValue({
      success: true,
      data: { id: "attempt-1", score: 100 },
    });

    renderWithProvider(<AttemptDetail attempt={createAttempt()} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Marcar respuesta corta como correcta/i })
    );

    await waitFor(() => {
      expect(mockGradeShortAnswer).toHaveBeenCalledWith({
        attemptId: "attempt-1",
        answerId: "a1",
        isCorrect: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Correcta")).toBeInTheDocument();
  });

  it("califica una respuesta corta como incorrecta y actualiza la nota", async () => {
    mockGradeShortAnswer.mockResolvedValue({
      success: true,
      data: { id: "attempt-1", score: 0 },
    });

    renderWithProvider(<AttemptDetail attempt={createAttempt()} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Marcar respuesta corta como incorrecta/i })
    );

    await waitFor(() => {
      expect(mockGradeShortAnswer).toHaveBeenCalledWith({
        attemptId: "attempt-1",
        answerId: "a1",
        isCorrect: false,
      });
    });

    await waitFor(() => {
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Incorrecta")).toBeInTheDocument();
  });

  it("muestra un toast si la corrección falla", async () => {
    mockGradeShortAnswer.mockResolvedValue({
      success: false,
      error: { type: "SYSTEM_ERROR", message: "Error de conexión" },
    });

    renderWithProvider(<AttemptDetail attempt={createAttempt()} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Marcar respuesta corta como correcta/i })
    );

    await waitFor(() => {
      expect(screen.getByText("Error de conexión")).toBeInTheDocument();
    });
  });

  it("muestra el enlace para repetir el test", () => {
    renderWithProvider(<AttemptDetail attempt={createAttempt()} />);

    const repeatLink = screen.getByRole("link", { name: /Repetir test/i });
    expect(repeatLink).toHaveAttribute("href", "/tests/test-1/attempt");
  });

  it("muestra el número de intento cuando se proporciona", () => {
    renderWithProvider(<AttemptDetail attempt={createAttempt()} number={3} />);

    expect(screen.getByText(/Intento #3/)).toBeInTheDocument();
  });
});
