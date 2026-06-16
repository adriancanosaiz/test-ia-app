// @vitest-environment jsdom

import { describe, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "./select";
import { SelectField, AccessibleSelectTrigger } from "./select-field";
import { expectNoViolations } from "@/lib/test/a11y";

const messages = {
  common: {
    scrollUp: "Desplazar hacia arriba",
    scrollDown: "Desplazar hacia abajo",
  },
};

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("Select", () => {
  afterEach(cleanup);

  it("has no accessibility violations when labelled", async () => {
    const { container } = renderWithProvider(
      <SelectField label="Opción">
        <Select value="a">
          <AccessibleSelectTrigger>
            <SelectValue />
          </AccessibleSelectTrigger>
          <SelectContent>
            <SelectItem value="a">Opción A</SelectItem>
          </SelectContent>
        </Select>
      </SelectField>
    );
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-labelledby");
    await expectNoViolations(container);
  });
});
