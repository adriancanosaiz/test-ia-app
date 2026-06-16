// @vitest-environment jsdom

import { describe, it, vi, afterEach, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import userEvent from "@testing-library/user-event";
import { MobileNav } from "./mobile-nav";
import { expectNoViolations } from "@/lib/test/a11y";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";

const mockUsePathname = vi.mocked(usePathname);

const messages = {
  navigation: {
    openMobileNavigation: "Abrir menú de navegación",
    mobileNavigation: "Menú de navegación",
    mobileNavigationDescription:
      "Navega entre las secciones principales de TestForge.",
    mobileNavigationAria: "Navegación móvil",
    dashboard: "Dashboard",
    chat: "Chat",
    tests: "Tests",
    settings: "Configuración",
  },
  common: {
    close: "Cerrar",
  },
};

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("MobileNav", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("has no accessibility violations when closed", async () => {
    mockUsePathname.mockReturnValue("/dashboard");
    const { container } = renderWithProvider(<MobileNav />);

    expect(
      screen.getByRole("button", { name: "Abrir menú de navegación" })
    ).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("has no accessibility violations when open", async () => {
    mockUsePathname.mockReturnValue("/dashboard");
    const { baseElement } = renderWithProvider(<MobileNav />);

    await userEvent.click(
      screen.getByRole("button", { name: "Abrir menú de navegación" })
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /dashboard/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Configuración/i })
    ).toBeInTheDocument();
    await expectNoViolations(baseElement);
  });
});
