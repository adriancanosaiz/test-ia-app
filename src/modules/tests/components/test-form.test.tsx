// @vitest-environment jsdom

import { describe, it, vi, afterEach, expect } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestForm } from "./test-form";
import { expectNoViolations } from "@/lib/test/a11y";
import { ToastProvider } from "@/hooks/use-toast";

const mockRouterPush = vi.fn();
const mockRouterRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, refresh: mockRouterRefresh }),
}));

vi.mock("../actions", () => ({
  createTest: vi.fn(),
  getScopeOptions: vi.fn(),
}));

import { createTest, getScopeOptions } from "../actions";

const mockCreateTest = vi.mocked(createTest);
const mockGetScopeOptions = vi.mocked(getScopeOptions);

function renderWithProvider(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("TestForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("has no accessibility violations", async () => {
    mockGetScopeOptions.mockResolvedValue([
      { id: "doc-1", name: "Apuntes" },
    ]);

    const { container } = renderWithProvider(<TestForm />);

    await userEvent.click(screen.getByRole("button", { name: "Nuevo test" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await expectNoViolations(container);
  });

  it("mapea los errores de validación a los campos correspondientes", async () => {
    mockGetScopeOptions.mockResolvedValue([
      { id: "doc-1", name: "Apuntes" },
    ]);
    mockCreateTest.mockResolvedValue({
      success: false,
      error: { type: "USER_ERROR", message: "Revisa los campos" },
      fieldErrors: {
        sourceId: ["El ámbito es obligatorio"],
        questionCount: ["Debe ser mayor o igual a 1"],
      },
    });

    renderWithProvider(<TestForm />);

    await userEvent.click(screen.getByRole("button", { name: "Nuevo test" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const elementSelect = screen.getByRole("combobox", { name: /Elemento/i });
    await waitFor(() => {
      expect(elementSelect).not.toBeDisabled();
    });

    await userEvent.click(elementSelect);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Apuntes" })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("option", { name: "Apuntes" }));

    await userEvent.click(screen.getByRole("button", { name: "Crear test" }));

    await waitFor(() => {
      expect(
        screen.getByText("Debe ser mayor o igual a 1")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("combobox", { name: /Elemento/i })
    ).toHaveAttribute("aria-invalid", "true");
  });
});
