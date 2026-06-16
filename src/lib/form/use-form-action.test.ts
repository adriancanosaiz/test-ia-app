// @vitest-environment jsdom

import { describe, it, vi, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFormAction } from "./use-form-action";
import { ActionResult } from "@/lib/errors";

function createFormData(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.append(key, value);
  }
  return formData;
}

describe("useFormAction", () => {
  it("envía exitosamente y llama a onSuccess", async () => {
    const onSuccess = vi.fn();
    const action = vi.fn(
      async (): Promise<ActionResult<{ id: string }>> => ({
        success: true,
        data: { id: "1" },
      })
    );

    const { result } = renderHook(() =>
      useFormAction({ action, onSuccess })
    );

    await act(async () => {
      await result.current.handleSubmit(createFormData({ name: "Test" }));
    });

    expect(action).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith({ id: "1" });
    expect(result.current.globalError).toBeNull();
    expect(result.current.fieldErrors).toEqual({});
  });

  it("mapea errores de campo", async () => {
    const action = vi.fn(
      async (): Promise<ActionResult<unknown>> => ({
        success: false,
        error: { type: "USER_ERROR", message: "Revisa los campos" },
        fieldErrors: { name: ["El nombre es obligatorio"] },
      })
    );

    const { result } = renderHook(() => useFormAction({ action }));

    await act(async () => {
      await result.current.handleSubmit(createFormData({ name: "" }));
    });

    expect(result.current.fieldErrors.name).toBe("El nombre es obligatorio");
    expect(result.current.globalError).toBeNull();
  });

  it("muestra error global cuando no hay errores de campo", async () => {
    const action = vi.fn(
      async (): Promise<ActionResult<unknown>> => ({
        success: false,
        error: { type: "USER_ERROR", message: "Error inesperado" },
      })
    );

    const { result } = renderHook(() => useFormAction({ action }));

    await act(async () => {
      await result.current.handleSubmit(createFormData({ name: "Test" }));
    });

    expect(result.current.globalError).toBe("Error inesperado");
    expect(result.current.fieldErrors).toEqual({});
  });

  it("limpia errores al enviar", async () => {
    const action = vi.fn(
      async (): Promise<ActionResult<unknown>> => ({
        success: false,
        error: { type: "USER_ERROR", message: "Error" },
      })
    );

    const { result } = renderHook(() => useFormAction({ action }));

    await act(async () => {
      await result.current.handleSubmit(createFormData({ name: "" }));
    });

    expect(result.current.globalError).toBe("Error");

    action.mockResolvedValueOnce({
      success: true,
      data: { id: "1" },
    });

    await act(async () => {
      await result.current.handleSubmit(createFormData({ name: "Test" }));
    });

    expect(result.current.globalError).toBeNull();
  });

  it("gestiona errores de excepción", async () => {
    const action = vi.fn(async () => {
      throw new Error("Fallo de red");
    });

    const { result } = renderHook(() => useFormAction({ action }));

    await act(async () => {
      await result.current.handleSubmit(createFormData({ name: "Test" }));
    });

    expect(result.current.globalError).toBe("Fallo de red");
  });
});
