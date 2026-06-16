// @vitest-environment jsdom

import { describe, it, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import DashboardPage from "./page";
import { expectNoViolations } from "@/lib/test/a11y";
import { NextIntlClientProvider } from "next-intl";
import dashboardMessages from "../../../messages/es/dashboard.json";
import navigationMessages from "../../../messages/es/navigation.json";
import errorsMessages from "../../../messages/es/errors.json";
import commonMessages from "../../../messages/es/common.json";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn((namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      dashboard: dashboardMessages,
      navigation: navigationMessages,
    };
    return Promise.resolve((key: string) => messages[namespace]?.[key] ?? key);
  }),
  getMessages: vi.fn(() => Promise.resolve({})),
  getLocale: vi.fn(() => Promise.resolve("es")),
}));

vi.mock("@/modules/folders/actions", () => ({
  getFolders: vi.fn(),
}));

vi.mock("@/lib/stats", () => ({
  getStats: vi.fn(),
}));

vi.mock("@/modules/folders/components/folder-form", () => ({
  FolderForm: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/modules/folders/components/folder-list", () => ({
  FolderList: () => <div data-testid="folder-list" />,
}));

vi.mock("@/components/ui/status-badge", () => ({
  StatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

import { getFolders } from "@/modules/folders/actions";
import { getStats } from "@/lib/stats";

function mockStats(overrides = {}) {
  return {
    folders: 0,
    documents: 0,
    documentsReady: 0,
    tests: 0,
    chatSessions: 0,
    attemptsCount: 0,
    averageScore: null,
    recentDocuments: [],
    recentTests: [],
    recentChats: [],
    ...overrides,
  };
}

async function renderDashboardPage() {
  return render(
    <NextIntlClientProvider
      locale="es"
      messages={{
        errors: errorsMessages,
        common: commonMessages,
      }}
    >
      {await DashboardPage()}
    </NextIntlClientProvider>
  );
}

describe("DashboardPage", () => {
  afterEach(cleanup);

  it("renders dashboard content when data loads", async () => {
    vi.mocked(getFolders).mockResolvedValue([]);
    vi.mocked(getStats).mockResolvedValue(mockStats());

    const { container } = await renderDashboardPage();

    expect(screen.getByRole("heading", { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByTestId("folder-list")).toBeInTheDocument();

    await expectNoViolations(container);
  });

  it("renders error state when data fetch fails", async () => {
    vi.mocked(getFolders).mockRejectedValue(new Error("DB error"));
    vi.mocked(getStats).mockRejectedValue(new Error("DB error"));

    const { container } = await renderDashboardPage();

    expect(
      screen.getByRole("heading", { name: /No se ha podido cargar el contenido/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reintentar/i })).toBeInTheDocument();

    await expectNoViolations(container);
  });

  it("muestra el widget de onboarding cuando no hay carpetas", async () => {
    vi.mocked(getFolders).mockResolvedValue([]);
    vi.mocked(getStats).mockResolvedValue(mockStats());

    const { container } = await renderDashboardPage();

    expect(
      screen.getByRole("heading", { name: /Bienvenido a TestForge/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Crear tu primera carpeta/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Crea tu primera carpeta/i)).toBeInTheDocument();
    expect(screen.getByText(/Añade asignaturas y documentos/i)).toBeInTheDocument();
    expect(screen.getByText(/Genera tests o chatea/i)).toBeInTheDocument();

    await expectNoViolations(container);
  });

  it("muestra tarjetas de resumen y actividad reciente cuando hay contenido", async () => {
    vi.mocked(getFolders).mockResolvedValue([
      {
        id: "folder-1",
        name: "Grado",
        description: null,
        color: null,
        createdAt: new Date("2026-06-01T10:00:00.000Z"),
        updatedAt: new Date("2026-06-01T10:00:00.000Z"),
        subjects: [],
        _count: { documents: 0 },
      },
    ]);
    vi.mocked(getStats).mockResolvedValue(
      mockStats({
        folders: 1,
        documents: 3,
        documentsReady: 2,
        tests: 4,
        chatSessions: 5,
        attemptsCount: 6,
        averageScore: 7.5,
        recentDocuments: [
          {
            id: "doc-1",
            title: "Apuntes",
            createdAt: new Date("2026-06-14T10:00:00.000Z"),
            subject: {
              id: "subject-1",
              name: "Matemáticas",
              folder: { id: "folder-1", name: "Grado" },
            },
          },
        ],
        recentTests: [
          {
            id: "test-1",
            title: "Test 1",
            status: "READY",
            createdAt: new Date("2026-06-14T09:00:00.000Z"),
          },
        ],
        recentChats: [
          {
            id: "chat-1",
            title: "Chat 1",
            createdAt: new Date("2026-06-14T08:00:00.000Z"),
            _count: { messages: 3 },
          },
        ],
      })
    );

    const { container } = await renderDashboardPage();

    const documentsCard = screen
      .getByRole("heading", { name: "Documentos listos" })
      .closest("article");
    expect(documentsCard).toHaveTextContent("2 / 3");
    expect(screen.getByText(/Documentos listos/i)).toBeInTheDocument();
    expect(screen.getByText(/Tests creados/i)).toBeInTheDocument();
    expect(screen.getByText(/Nota media/i)).toBeInTheDocument();
    expect(screen.getByText(/7,5/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /Actividad reciente/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Apuntes/i })).toHaveAttribute(
      "href",
      "/subjects/subject-1"
    );
    expect(screen.getByRole("link", { name: /Test 1/i })).toHaveAttribute(
      "href",
      "/tests/test-1"
    );
    expect(screen.getByRole("link", { name: /Chat 1/i })).toHaveAttribute(
      "href",
      "/chat/chat-1"
    );

    await expectNoViolations(container);
  });

  it("muestra 'Aún sin intentos' cuando no hay intentos", async () => {
    vi.mocked(getFolders).mockResolvedValue([
      {
        id: "folder-1",
        name: "Grado",
        description: null,
        color: null,
        createdAt: new Date("2026-06-01T10:00:00.000Z"),
        updatedAt: new Date("2026-06-01T10:00:00.000Z"),
        subjects: [],
        _count: { documents: 0 },
      },
    ]);
    vi.mocked(getStats).mockResolvedValue(
      mockStats({
        folders: 1,
        attemptsCount: 0,
        averageScore: null,
      })
    );

    await renderDashboardPage();

    expect(screen.getByText(/Aún sin intentos/i)).toBeInTheDocument();
  });
});
