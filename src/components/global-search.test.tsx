// @vitest-environment jsdom

import { describe, it, vi, afterEach, expect } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import userEvent from "@testing-library/user-event";
import { GlobalSearch } from "./global-search";
import { expectNoViolations } from "@/lib/test/a11y";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

const messages = {
  navigation: {
    search: "Buscar",
    openGlobalSearch: "Abrir búsqueda global (Cmd+K)",
    globalSearch: "Búsqueda global",
    globalSearchDescription:
      "Busca y navega rápidamente a carpetas, asignaturas, documentos, tests y chats.",
    searchTerm: "Término de búsqueda",
    globalSearchPlaceholder: "Buscar carpetas, asignaturas, documentos...",
    all: "Todo",
    folders: "Carpetas",
    subjects: "Asignaturas",
    documents: "Documentos",
    tests: "Tests",
    chat: "Chat",
    noResultsFor: "No se han encontrado resultados para \"{query}\"",
    startTyping: "Empieza a escribir para buscar o selecciona una pestaña.",
    resultsFound: "{count} resultados encontrados",
    toNavigate: "para navegar",
    toClose: "para cerrar",
  },
  common: {
    close: "Cerrar",
    search: "Buscar",
  },
};

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

const sampleItems = [
  {
    id: "folder-1",
    type: "folder" as const,
    title: "Grado en Informática",
    subtitle: "Apuntes del grado",
    href: "/folders/folder-1",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-10"),
  },
  {
    id: "subject-1",
    type: "subject" as const,
    title: "Matemáticas",
    subtitle: "Grado en Informática",
    href: "/subjects/subject-1",
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-11"),
  },
  {
    id: "doc-1",
    type: "document" as const,
    title: "Apuntes de álgebra",
    subtitle: "Grado en Informática · Matemáticas",
    href: "/documents/doc-1/summaries",
    createdAt: new Date("2024-01-03"),
    updatedAt: new Date("2024-01-12"),
  },
  {
    id: "test-1",
    type: "test" as const,
    title: "Test de álgebra",
    subtitle: "Documento: Apuntes de álgebra",
    href: "/tests/test-1",
    createdAt: new Date("2024-01-04"),
    updatedAt: new Date("2024-01-13"),
  },
  {
    id: "chat-1",
    type: "chat" as const,
    title: "Dudas de álgebra",
    subtitle: "Documento: Apuntes de álgebra",
    href: "/chat/chat-1",
    createdAt: new Date("2024-01-05"),
    updatedAt: new Date("2024-01-14"),
  },
];

describe("GlobalSearch", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("no muestra el diálogo por defecto", () => {
    renderWithProvider(<GlobalSearch items={sampleItems} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre el diálogo al pulsar el botón", async () => {
    const { baseElement } = renderWithProvider(<GlobalSearch items={sampleItems} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Abrir búsqueda global/i })
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await expectNoViolations(baseElement);
  });

  it("abre el diálogo con el atajo de teclado Cmd+K", async () => {
    renderWithProvider(<GlobalSearch items={sampleItems} />);

    await userEvent.keyboard("{Meta>}k{/Meta}");

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("filtra resultados por título al escribir", async () => {
    renderWithProvider(<GlobalSearch items={sampleItems} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Abrir búsqueda global/i })
    );

    const input = screen.getByLabelText("Término de búsqueda");
    await userEvent.type(input, "álgebra");

    await waitFor(() => {
      expect(screen.getByText("Apuntes de álgebra")).toBeInTheDocument();
      expect(screen.getByText("Test de álgebra")).toBeInTheDocument();
      expect(screen.getByText("Dudas de álgebra")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Grado en Informática")
    ).not.toBeInTheDocument();
  });

  it("muestra mensaje cuando no hay resultados", async () => {
    renderWithProvider(<GlobalSearch items={sampleItems} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Abrir búsqueda global/i })
    );

    const input = screen.getByLabelText("Término de búsqueda");
    await userEvent.type(input, "xyz");

    await waitFor(() => {
      expect(
        screen.getByText(/No se han encontrado resultados/i)
      ).toBeInTheDocument();
    });
  });

  it("navega al seleccionar un resultado", async () => {
    renderWithProvider(<GlobalSearch items={sampleItems} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Abrir búsqueda global/i })
    );

    await userEvent.click(screen.getByText("Matemáticas"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/subjects/subject-1");
    });
  });

  it("filtra por pestaña de tipo", async () => {
    renderWithProvider(<GlobalSearch items={sampleItems} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Abrir búsqueda global/i })
    );

    await userEvent.click(screen.getByRole("tab", { name: "Tests" }));

    await waitFor(() => {
      expect(screen.getByText("Test de álgebra")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Apuntes de álgebra")
    ).not.toBeInTheDocument();
  });
});
