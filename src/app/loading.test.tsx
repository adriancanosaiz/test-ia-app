// @vitest-environment jsdom

import { describe, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import Loading from "./loading";
import { expectNoViolations } from "@/lib/test/a11y";

const messages = {
  common: {
    loadingContent: "Cargando contenido",
  },
};

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("Loading", () => {
  afterEach(cleanup);

  it("renders skeleton loaders and has no accessibility violations", async () => {
    const { container } = renderWithProvider(<Loading />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByLabelText(/Cargando contenido/i)).toBeInTheDocument();

    await expectNoViolations(container);
  });
});
