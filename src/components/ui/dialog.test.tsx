// @vitest-environment jsdom

import { describe, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { expectNoViolations } from "@/lib/test/a11y";

const messages = {
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

describe("Dialog", () => {
  afterEach(cleanup);

  it("has no accessibility violations when open", async () => {
    const { baseElement } = renderWithProvider(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Título del diálogo</DialogTitle>
            <DialogDescription>Descripción del diálogo.</DialogDescription>
          </DialogHeader>
          <p>Contenido</p>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await expectNoViolations(baseElement);
  });
});
