// @vitest-environment jsdom

import { describe, it, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./confirm-dialog";
import { expectNoViolations } from "@/lib/test/a11y";

const messages = {
  common: {
    confirm: "Confirmar",
    cancel: "Cancelar",
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

describe("ConfirmDialog", () => {
  afterEach(cleanup);

  it("has no accessibility violations when open", async () => {
    const { baseElement } = renderWithProvider(
      <ConfirmDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        title="¿Eliminar?"
        description="Esta acción no se puede deshacer."
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await expectNoViolations(baseElement);
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderWithProvider(
      <ConfirmDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        title="¿Eliminar?"
        onConfirm={onConfirm}
      />
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenChange when cancel button is clicked", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProvider(
      <ConfirmDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        title="¿Eliminar?"
        onConfirm={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
