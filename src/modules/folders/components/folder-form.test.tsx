// @vitest-environment jsdom

import { describe, it, vi, afterEach, expect } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { FolderForm } from "./folder-form";
import { expectNoViolations } from "@/lib/test/a11y";
import { ToastProvider } from "@/hooks/use-toast";
import foldersMessages from "../../../../messages/es/folders.json";
import commonMessages from "../../../../messages/es/common.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("../actions", () => ({
  createFolder: vi.fn(),
}));

import { createFolder } from "../actions";

const mockCreateFolder = vi.mocked(createFolder);

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider
      locale="es"
      messages={{ folders: foldersMessages, common: commonMessages }}
    >
      <ToastProvider>{ui}</ToastProvider>
    </NextIntlClientProvider>
  );
}

describe("FolderForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("has no accessibility violations when open", async () => {
    const { baseElement } = renderWithProvider(<FolderForm />);

    await userEvent.click(screen.getByRole("button", { name: "Nueva carpeta" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    await expectNoViolations(baseElement);
  });

  it("envía el formulario con color seleccionado", async () => {
    mockCreateFolder.mockResolvedValueOnce({
      success: true,
      data: {
        id: "folder-1",
        name: "Nueva carpeta",
        description: null,
        color: "#ef4444",
      },
    });

    renderWithProvider(<FolderForm />);

    await userEvent.click(screen.getByRole("button", { name: "Nueva carpeta" }));

    const dialog = screen.getByRole("dialog");
    await userEvent.type(screen.getByLabelText(/nombre/i), "Nueva carpeta");
    await userEvent.click(
      screen.getByRole("button", { name: "Seleccionar color #ef4444" })
    );
    fireEvent.submit(dialog.querySelector("form")!);

    await waitFor(() => {
      expect(mockCreateFolder).toHaveBeenCalledWith(expect.any(FormData));
    });

    const formData = mockCreateFolder.mock.calls[0][0] as FormData;
    expect(formData.get("name")).toBe("Nueva carpeta");
    expect(formData.get("color")).toBe("#ef4444");
  });

  it("muestra errores de campo", async () => {
    mockCreateFolder.mockResolvedValueOnce({
      success: false,
      error: { type: "USER_ERROR", message: "Revisa los campos" },
      fieldErrors: { name: ["El nombre es obligatorio"] },
    });

    renderWithProvider(<FolderForm />);

    await userEvent.click(screen.getByRole("button", { name: "Nueva carpeta" }));
    const dialog = screen.getByRole("dialog");
    const form = dialog.querySelector("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("El nombre es obligatorio")).toBeInTheDocument();
    });
  });
});
