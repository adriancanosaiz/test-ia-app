// @vitest-environment jsdom

import { describe, it, afterEach, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Breadcrumb } from "./breadcrumb";
import { expectNoViolations } from "@/lib/test/a11y";

const messages = {
  navigation: {
    breadcrumb: "Breadcrumb",
  },
};

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("Breadcrumb", () => {
  afterEach(cleanup);

  it("renders links, current page and has no accessibility violations", async () => {
    const { container } = renderWithProvider(
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Carpeta", href: "/folders/1" },
          { label: "Documento" },
        ]}
      />
    );

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Carpeta" })).toBeInTheDocument();
    expect(screen.getByText("Documento")).toHaveAttribute("aria-current", "page");
    await expectNoViolations(container);
  });
});
