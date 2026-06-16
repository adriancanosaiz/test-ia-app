export type ErrorType = "USER_ERROR" | "SYSTEM_ERROR";

export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type AppError = {
  type: ErrorType;
  message: string;
  code?: string;
};

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: AppError; fieldErrors?: FieldErrors };

export function createUserError(message: string, code?: string): AppError {
  return { type: "USER_ERROR", message, code };
}

export function createSystemError(message: string, code?: string): AppError {
  return { type: "SYSTEM_ERROR", message, code };
}

export function isUserError(error: AppError): boolean {
  return error.type === "USER_ERROR";
}

export function isSystemError(error: AppError): boolean {
  return error.type === "SYSTEM_ERROR";
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Error desconocido";
}

export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error.type === "USER_ERROR" || error.type === "SYSTEM_ERROR") &&
    "message" in error &&
    typeof error.message === "string"
  );
}

export function isZodError(error: unknown): boolean {
  return error instanceof Error && error.name === "ZodError";
}

export class AppErrorClass extends Error implements AppError {
  type: ErrorType;
  code?: string;

  constructor(type: ErrorType, message: string, code?: string) {
    super(message);
    this.type = type;
    this.name = "AppError";
    this.code = code;
  }
}
