// @vitest-environment jsdom

import { describe, it, vi, afterEach, expect } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { DocumentUpload } from "./document-upload";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/toaster";
import { expectNoViolations } from "@/lib/test/a11y";

const mockRouterRefresh = vi.fn();
const mockRouter = { push: vi.fn(), refresh: mockRouterRefresh };

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("../actions", () => ({
  uploadDocument: vi.fn(),
}));

import { uploadDocument } from "../actions";

const mockUploadDocument = vi.mocked(uploadDocument);

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <main>
      <ToastProvider>
        {ui}
        <Toaster />
      </ToastProvider>
    </main>
  );
}

function getFileInput() {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

function uploadFile(file: File) {
  const input = getFileInput();
  fireEvent.change(input, { target: { files: [file] } });
}

function submitForm() {
  const form = document.querySelector("form");
  fireEvent.submit(form!);
}

describe("DocumentUpload", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("muestra el formulario accesible", async () => {
    const { baseElement } = renderWithProvider(
      <DocumentUpload subjectId="subject-1" />
    );

    expect(
      screen.getByRole("button", { name: "Subir documento" })
    ).toBeInTheDocument();
    await expectNoViolations(baseElement);
  });

  it("deshabilita el botón de subir hasta seleccionar un archivo", () => {
    renderWithProvider(<DocumentUpload subjectId="subject-1" />);

    expect(
      screen.getByRole("button", { name: "Subir documento" })
    ).toBeDisabled();
  });

  it("muestra error al seleccionar un tipo no soportado", async () => {
    renderWithProvider(<DocumentUpload subjectId="subject-1" />);

    uploadFile(new File(["x"], "image.png", { type: "image/png" }));

    expect(screen.getByText(/Formato no soportado/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Subir documento" })
    ).toBeDisabled();
  });

  it("muestra error si el archivo supera 10 MB", async () => {
    renderWithProvider(<DocumentUpload subjectId="subject-1" />);

    const content = new Uint8Array(10 * 1024 * 1024 + 1);
    uploadFile(new File([content], "big.pdf", { type: "application/pdf" }));

    expect(
      screen.getByText(/supera el tamaño máximo/i)
    ).toBeInTheDocument();
  });

  it("muestra spinner mientras se sube", async () => {
    mockUploadDocument.mockImplementation(() => new Promise(() => {}));

    renderWithProvider(<DocumentUpload subjectId="subject-1" />);

    uploadFile(new File(["contenido"], "notas.pdf", { type: "application/pdf" }));

    const submitButton = screen.getByRole("button", { name: "Subir documento" });
    await waitFor(() => expect(submitButton).toBeEnabled());

    submitForm();

    expect(await screen.findByText("Subiendo...")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Subiendo..." })
    ).toHaveAttribute("aria-busy", "true");
  });

  it("sube un archivo válido y refresca la página", async () => {
    mockUploadDocument.mockResolvedValue({
      success: true,
      data: {
        id: "doc-1",
        title: "notas",
        mimeType: "text/plain",
        status: "PENDING",
      },
    });

    renderWithProvider(<DocumentUpload subjectId="subject-1" />);

    uploadFile(
      new File(["contenido de prueba"], "notas.pdf", { type: "application/pdf" })
    );

    const submitButton = screen.getByRole("button", { name: "Subir documento" });
    await waitFor(() => expect(submitButton).toBeEnabled());

    submitForm();

    await vi.waitFor(() => {
      expect(mockUploadDocument).toHaveBeenCalled();
    });

    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("muestra error amigable si la subida falla", async () => {
    mockUploadDocument.mockResolvedValue({
      success: false,
      error: { type: "SYSTEM_ERROR", message: "Error de red" },
    });

    renderWithProvider(<DocumentUpload subjectId="subject-1" />);

    uploadFile(new File(["contenido"], "notas.pdf", { type: "application/pdf" }));

    const submitButton = screen.getByRole("button", { name: "Subir documento" });
    await waitFor(() => expect(submitButton).toBeEnabled());

    submitForm();

    expect(await screen.findByText("Error de red")).toBeInTheDocument();
  });
});
