// @vitest-environment jsdom

import { describe, it, vi, afterEach, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./theme-toggle";
import { ThemeProvider } from "./theme-provider";
import { expectNoViolations } from "@/lib/test/a11y";

function mockMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

const messages = {
  common: {
    themeLight: "Cambiar a tema claro",
    themeDark: "Cambiar a tema oscuro",
    themeSystem: "Usar tema del sistema",
  },
};

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("ThemeToggle", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders button and has no accessibility violations", async () => {
    mockMatchMedia();
    const { container } = renderWithProvider(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>
    );

    expect(
      screen.getByRole("button", { name: "Cambiar a tema oscuro" })
    ).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("cycles theme on click", async () => {
    mockMatchMedia();
    renderWithProvider(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Cambiar a tema oscuro" })
    );
    expect(
      screen.getByRole("button", { name: "Usar tema del sistema" })
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Usar tema del sistema" })
    );
    expect(
      screen.getByRole("button", { name: "Cambiar a tema claro" })
    ).toBeInTheDocument();
  });
});
