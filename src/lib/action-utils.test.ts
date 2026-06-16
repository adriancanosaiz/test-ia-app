import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { action, parseFormData } from "./action-utils";

const testSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  age: z.number().min(0),
});

describe("parseFormData", () => {
  it("parsea datos válidos", () => {
    const result = parseFormData(testSchema, { name: "Ada", age: 30 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Ada", age: 30 });
    }
  });

  it("devuelve errores por campo", () => {
    const result = parseFormData(testSchema, { name: "", age: -1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.name).toContain("El nombre es obligatorio");
      expect(result.fieldErrors.age).toBeDefined();
    }
  });
});

describe("action", () => {
  it("devuelve éxito con los datos", async () => {
    const result = await action(async () => "ok");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("ok");
    }
  });

  it("clasifica errores de Zod como errores de usuario", async () => {
    const result = await action(async () => {
      testSchema.parse({ name: "" });
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
    }
  });

  it("clasifica errores de Prisma P2025 como errores de usuario", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Record not found",
      { code: "P2025", clientVersion: "x" }
    );

    const result = await action(async () => {
      throw prismaError;
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
      expect(result.error.message).toBe("El recurso solicitado no existe.");
    }
  });

  it("clasifica otros errores de Prisma como errores de sistema", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Connection failed",
      { code: "P1001", clientVersion: "x" }
    );

    const result = await action(async () => {
      throw prismaError;
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("SYSTEM_ERROR");
    }
  });

  it("clasifica errores genéricos como errores de usuario", async () => {
    const result = await action(async () => {
      throw new Error("Algo salió mal");
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
      expect(result.error.message).toBe("Algo salió mal");
    }
  });
});
