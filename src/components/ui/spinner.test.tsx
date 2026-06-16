// @vitest-environment jsdom

import { describe, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Spinner } from "./spinner";
import { expectNoViolations } from "@/lib/test/a11y";

const messages = {
  common: {
    loadingLabel: "Cargando",
  },
};

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("Spinner", () => {
  afterEach(cleanup);

  it("has no accessibility violations", async () => {
    const { container } = renderWithProvider(<Spinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("has a default loading label", () => {
    renderWithProvider(<Spinner />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Cargando");
  });

  it("supports custom label", () => {
    renderWithProvider(<Spinner label="Guardando" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Guardando");
  });
});
