// @vitest-environment jsdom

import { describe, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { StatusBadge } from "./status-badge";
import { expectNoViolations } from "@/lib/test/a11y";

const messages = {
  common: {
    statusPending: "Pendiente",
    statusProcessing: "Procesando",
    statusReady: "Listo",
    statusError: "Error",
    statusDraft: "Borrador",
    statusCompleted: "Completado",
    statusFailed: "Fallido",
    statusCancelled: "Cancelado",
  },
};

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("StatusBadge", () => {
  afterEach(cleanup);

  it("has no accessibility violations", async () => {
    const { container } = renderWithProvider(<StatusBadge status="READY" />);
    expect(screen.getByText("Listo")).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it.each([
    ["PENDING", "Pendiente"],
    ["PROCESSING", "Procesando"],
    ["READY", "Listo"],
    ["ERROR", "Error"],
    ["DRAFT", "Borrador"],
    ["COMPLETED", "Completado"],
    ["FAILED", "Fallido"],
    ["CANCELLED", "Cancelado"],
  ] as const)("renders label for status %s", (status, label) => {
    renderWithProvider(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
