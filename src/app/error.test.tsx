// @vitest-environment jsdom

import { describe, it, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import userEvent from "@testing-library/user-event";
import ErrorPage from "./error";
import { expectNoViolations } from "@/lib/test/a11y";

const messages = {
  errors: {
    title: "Algo ha salido mal",
    recoverableDescription:
      "Se ha producido un error temporal. Puedes intentarlo de nuevo o volver al dashboard.",
    nonRecoverableDescription:
      "Se ha producido un error inesperado. Vuelve al dashboard para continuar.",
    referenceCode: "Código de referencia",
    tryAgain: "Intentar de nuevo",
    backToDashboard: "Volver al dashboard",
  },
};

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("ErrorPage", () => {
  afterEach(cleanup);

  it("renders recoverable error with retry button", async () => {
    const reset = vi.fn();
    const { container } = renderWithProvider(
      <ErrorPage error={new Error("Network timeout")} reset={reset} />
    );

    expect(
      screen.getByRole("heading", { name: /Algo ha salido mal/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Se ha producido un error temporal/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Intentar de nuevo/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Volver al dashboard/i })
    ).toBeInTheDocument();

    await expectNoViolations(container);
  });

  it("renders non-recoverable error without retry button", async () => {
    const reset = vi.fn();
    const { container } = renderWithProvider(
      <ErrorPage error={new Error("Invalid hook call")} reset={reset} />
    );

    expect(
      screen.getByText(/Se ha producido un error inesperado/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Intentar de nuevo/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Volver al dashboard/i })
    ).toBeInTheDocument();

    await expectNoViolations(container);
  });

  it("calls reset when retry is clicked", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    renderWithProvider(
      <ErrorPage error={new Error("failed to fetch")} reset={reset} />
    );

    await user.click(
      screen.getByRole("button", { name: /Intentar de nuevo/i })
    );
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("does not expose raw system error messages", () => {
    renderWithProvider(
      <ErrorPage
        error={new Error("Prisma connection failed")}
        reset={vi.fn()}
      />
    );

    expect(screen.queryByText(/Prisma/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connection failed/i)).not.toBeInTheDocument();
  });
});
