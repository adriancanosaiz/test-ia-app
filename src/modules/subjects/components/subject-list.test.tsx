// @vitest-environment jsdom

import { describe, it, vi, afterEach, expect } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { SubjectList } from "./subject-list";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/toaster";
import { expectNoViolations } from "@/lib/test/a11y";
import subjectsMessages from "../../../../messages/es/subjects.json";
import commonMessages from "../../../../messages/es/common.json";

const mockRouterRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRouterRefresh }),
}));

vi.mock("../actions", () => ({
  deleteSubject: vi.fn(),
}));

import { deleteSubject } from "../actions";

const mockDeleteSubject = vi.mocked(deleteSubject);

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider
      locale="es"
      messages={{ subjects: subjectsMessages, common: commonMessages }}
    >
      <ToastProvider>
        {ui}
        <Toaster />
      </ToastProvider>
    </NextIntlClientProvider>
  );
}

const sampleSubjects = [
  {
    id: "subject-1",
    name: "Asignatura de prueba",
    description: "Descripción",
    createdAt: new Date("2026-06-01T10:00:00.000Z"),
    updatedAt: new Date("2026-06-01T10:00:00.000Z"),
    _count: { documents: 1 },
  },
];

describe("SubjectList", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("muestra empty state accesible cuando no hay asignaturas", async () => {
    const { container } = renderWithProvider(
      <SubjectList folderId="folder-1" subjects={[]} />
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("No hay asignaturas todavía")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nueva asignatura" })
    ).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithProvider(
      <SubjectList folderId="folder-1" subjects={sampleSubjects} />
    );
    await expectNoViolations(container);
  });

  it("abre el diálogo de confirmación al pulsar eliminar", async () => {
    const { baseElement } = renderWithProvider(
      <SubjectList folderId="folder-1" subjects={sampleSubjects} />
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Eliminar asignatura Asignatura de prueba",
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await expectNoViolations(baseElement);
  });

  it("elimina la asignatura al confirmar", async () => {
    mockDeleteSubject.mockResolvedValue({
      success: true,
      data: { folderId: "folder-1" },
    });

    renderWithProvider(
      <SubjectList folderId="folder-1" subjects={sampleSubjects} />
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Eliminar asignatura Asignatura de prueba",
      })
    );

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(mockDeleteSubject).toHaveBeenCalledWith("subject-1");
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("muestra un toast si la eliminación falla", async () => {
    mockDeleteSubject.mockResolvedValue({
      success: false,
      error: { type: "SYSTEM_ERROR", message: "Error de conexión" },
    });

    renderWithProvider(
      <SubjectList folderId="folder-1" subjects={sampleSubjects} />
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Eliminar asignatura Asignatura de prueba",
      })
    );

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(screen.getByText("Error de conexión")).toBeInTheDocument();
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
