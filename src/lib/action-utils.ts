import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  ActionResult,
  AppError,
  createSystemError,
  createUserError,
  ErrorCode,
  FieldErrors,
  isAppError,
  isZodError,
  safeErrorMessage,
} from "./errors";

function logServerError(error: unknown) {
  if (process.env.NODE_ENV !== "test") {
    console.error({
      error: safeErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}

export function parseFormData<S extends z.ZodSchema>(
  schema: S,
  data: unknown
):
  | { success: true; data: z.infer<S> }
  | { success: false; fieldErrors: FieldErrors } {
  const result = schema.safeParse(data);

  if (!result.success) {
    const fieldErrors: FieldErrors = {};

    for (const issue of result.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string") {
        const current = fieldErrors[path] ?? [];
        current.push(issue.message);
        fieldErrors[path] = current;
      }
    }

    return { success: false, fieldErrors };
  }

  return { success: true, data: result.data };
}

function classifyError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (isZodError(error)) {
    return createUserError("Los datos enviados no son válidos.", ErrorCode.VALIDATION_ERROR);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return createUserError("El recurso solicitado no existe.", ErrorCode.RESOURCE_NOT_FOUND);
    }
    return createSystemError(
      "Ha ocurrido un error inesperado. Inténtalo de nuevo.",
      ErrorCode.DATABASE_ERROR
    );
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return createSystemError(
      "Ha ocurrido un error inesperado. Inténtalo de nuevo.",
      ErrorCode.DATABASE_ERROR
    );
  }

  if (error instanceof Error && error.name.startsWith("Prisma")) {
    return createSystemError(
      "Ha ocurrido un error inesperado. Inténtalo de nuevo.",
      ErrorCode.DATABASE_ERROR
    );
  }

  if (error instanceof Error) {
    return createUserError(error.message);
  }

  return createSystemError(
    "Ha ocurrido un error inesperado. Inténtalo de nuevo.",
    ErrorCode.UNKNOWN_ERROR
  );
}

export async function action<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    logServerError(error);
    return { success: false, error: classifyError(error) };
  }
}
