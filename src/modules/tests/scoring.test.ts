import { describe, expect, it } from "vitest";
import { calculateAttemptStats, calculateScore, gradeAnswer } from "./scoring";

describe("gradeAnswer", () => {
  it("califica opción múltiple correcta", () => {
    const result = gradeAnswer(
      { questionId: "q1", selectedOptionId: "opt-correct" },
      { type: "MULTIPLE_CHOICE", isCorrect: null, modelAnswer: null },
      [
        { id: "opt-wrong", isCorrect: false },
        { id: "opt-correct", isCorrect: true },
      ]
    );
    expect(result).toBe(true);
  });

  it("califica opción múltiple incorrecta", () => {
    const result = gradeAnswer(
      { questionId: "q1", selectedOptionId: "opt-wrong" },
      { type: "MULTIPLE_CHOICE", isCorrect: null, modelAnswer: null },
      [
        { id: "opt-wrong", isCorrect: false },
        { id: "opt-correct", isCorrect: true },
      ]
    );
    expect(result).toBe(false);
  });

  it("califica verdadero/falso correcto", () => {
    const result = gradeAnswer(
      { questionId: "q1", booleanAnswer: true },
      { type: "TRUE_FALSE", isCorrect: true, modelAnswer: null },
      []
    );
    expect(result).toBe(true);
  });

  it("califica verdadero/falso incorrecto", () => {
    const result = gradeAnswer(
      { questionId: "q1", booleanAnswer: false },
      { type: "TRUE_FALSE", isCorrect: true, modelAnswer: null },
      []
    );
    expect(result).toBe(false);
  });

  it("respuesta corta queda sin calificar", () => {
    const result = gradeAnswer(
      { questionId: "q1", textAnswer: "una respuesta" },
      { type: "SHORT_ANSWER", isCorrect: null, modelAnswer: "modelo" },
      []
    );
    expect(result).toBeNull();
  });
});

describe("calculateScore", () => {
  it("devuelve null si todas las preguntas son respuesta corta", () => {
    const result = calculateScore(
      [{ questionId: "q1", textAnswer: "x", isCorrect: null }],
      [{ id: "q1", type: "SHORT_ANSWER" }]
    );
    expect(result).toBeNull();
  });

  it("calcula porcentaje sobre preguntas autoevaluables", () => {
    const result = calculateScore(
      [
        { questionId: "q1", selectedOptionId: "opt1", isCorrect: true },
        { questionId: "q2", selectedOptionId: "opt2", isCorrect: false },
        { questionId: "q3", textAnswer: "x", isCorrect: null },
      ],
      [
        { id: "q1", type: "MULTIPLE_CHOICE" },
        { id: "q2", type: "MULTIPLE_CHOICE" },
        { id: "q3", type: "SHORT_ANSWER" },
      ]
    );
    expect(result).toBe(50);
  });
});

describe("calculateAttemptStats", () => {
  it("devuelve null cuando no hay respuestas calificadas", () => {
    const result = calculateAttemptStats(
      [
        { questionId: "q1", isCorrect: null },
        { questionId: "q2", isCorrect: null },
      ],
      [
        { id: "q1", type: "SHORT_ANSWER" },
        { id: "q2", type: "SHORT_ANSWER" },
      ]
    );
    expect(result.score).toBeNull();
    expect(result.autoScore).toBeNull();
  });

  it("calcula nota sobre respuestas calificadas y nota autoevaluable", () => {
    const result = calculateAttemptStats(
      [
        { questionId: "q1", isCorrect: true },
        { questionId: "q2", isCorrect: false },
        { questionId: "q3", isCorrect: true },
      ],
      [
        { id: "q1", type: "MULTIPLE_CHOICE" },
        { id: "q2", type: "MULTIPLE_CHOICE" },
        { id: "q3", type: "SHORT_ANSWER" },
      ]
    );
    expect(result.total).toBe(3);
    expect(result.correct).toBe(2);
    expect(result.gradedCount).toBe(3);
    expect(result.score).toBe(67);
    expect(result.autoGradableTotal).toBe(2);
    expect(result.autoGradableCorrect).toBe(1);
    expect(result.autoScore).toBe(50);
  });
});
