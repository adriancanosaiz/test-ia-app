import { describe, expect, it } from "vitest";
import {
  createUserError,
  createSystemError,
  isUserError,
  isSystemError,
  safeErrorMessage,
  isZodError,
} from "./errors";

describe("errors", () => {
  it("crea errores de usuario", () => {
    const error = createUserError("Campo inválido", "INVALID_FIELD");

    expect(error.type).toBe("USER_ERROR");
    expect(error.message).toBe("Campo inválido");
    expect(error.code).toBe("INVALID_FIELD");
  });

  it("crea errores de sistema", () => {
    const error = createSystemError("Error interno", "INTERNAL");

    expect(error.type).toBe("SYSTEM_ERROR");
    expect(error.message).toBe("Error interno");
    expect(error.code).toBe("INTERNAL");
  });

  it("detecta errores de usuario", () => {
    expect(isUserError(createUserError("x"))).toBe(true);
    expect(isUserError(createSystemError("x"))).toBe(false);
  });

  it("detecta errores de sistema", () => {
    expect(isSystemError(createSystemError("x"))).toBe(true);
    expect(isSystemError(createUserError("x"))).toBe(false);
  });

  it("extrae mensajes de error de forma segura", () => {
    expect(safeErrorMessage(new Error("fallo"))).toBe("fallo");
    expect(safeErrorMessage("texto")).toBe("Error desconocido");
    expect(safeErrorMessage(null)).toBe("Error desconocido");
  });

  it("detecta errores de Zod", () => {
    const zodError = new Error("Validation failed");
    zodError.name = "ZodError";

    expect(isZodError(zodError)).toBe(true);
    expect(isZodError(new Error("Other"))).toBe(false);
  });
});
