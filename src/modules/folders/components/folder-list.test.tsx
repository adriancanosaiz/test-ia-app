// @vitest-environment jsdom

import { describe, it, vi, afterEach, expect } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { FolderList } from "./folder-list";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/toaster";
import { expectNoViolations } from "@/lib/test/a11y";
import foldersMessages from "../../../../messages/es/folders.json";
import commonMessages from "../../../../messages/es/common.json";

const mockRouterRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRouterRefresh }),
}));

vi.mock("../actions", () => ({
  deleteFolder: vi.fn(),
}));

import { deleteFolder } from "../actions";

const mockDeleteFolder = vi.mocked(deleteFolder);

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider
      locale="es"
      messages={{ folders: foldersMessages, common: commonMessages }}
    >
      <ToastProvider>
        {ui}
        <Toaster />
      </ToastProvider>
    </NextIntlClientProvider>
  );
}

const sampleFolders = [
  {
    id: "folder-1",
    name: "Carpeta de prueba",
    description: "Descripción",
    color: "#ef4444",
    createdAt: new Date("2026-06-01T10:00:00.000Z"),
    updatedAt: new Date("2026-06-01T10:00:00.000Z"),
    _count: { documents: 2 },
  },
];

describe("FolderList", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("muestra empty state accesible cuando no hay carpetas", async () => {
    const { container } = renderWithProvider(<FolderList folders={[]} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("No hay carpetas todavía")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nueva carpeta" })
    ).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithProvider(
      <FolderList folders={sampleFolders} />
    );
    await expectNoViolations(container);
  });

  it("muestra el empty state cuando no hay carpetas", async () => {
    const { container } = renderWithProvider(<FolderList folders={[]} />);

    expect(
      screen.getByRole("heading", { name: "No hay carpetas todavía" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Nueva carpeta/i })
    ).toBeInTheDocument();

    await expectNoViolations(container);
  });

  it("abre el diálogo de confirmación al pulsar eliminar", async () => {
    const { baseElement } = renderWithProvider(
      <FolderList folders={sampleFolders} />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar carpeta Carpeta de prueba" })
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await expectNoViolations(baseElement);
  });

  it("elimina la carpeta al confirmar", async () => {
    mockDeleteFolder.mockResolvedValue({
      success: true,
      data: undefined,
    });

    renderWithProvider(<FolderList folders={sampleFolders} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar carpeta Carpeta de prueba" })
    );

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(mockDeleteFolder).toHaveBeenCalledWith("folder-1");
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("muestra un toast si la eliminación falla", async () => {
    mockDeleteFolder.mockResolvedValue({
      success: false,
      error: { type: "SYSTEM_ERROR", message: "Error de conexión" },
    });

    renderWithProvider(<FolderList folders={sampleFolders} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar carpeta Carpeta de prueba" })
    );

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(screen.getByText("Error de conexión")).toBeInTheDocument();
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
