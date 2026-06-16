// @vitest-environment jsdom

import { describe, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EmptyState } from "./empty-state";
import { InboxIcon } from "lucide-react";
import { expectNoViolations } from "@/lib/test/a11y";

describe("EmptyState", () => {
  afterEach(cleanup);

  it("has no accessibility violations", async () => {
    const { container } = render(
      <EmptyState
        icon={InboxIcon}
        title="Sin elementos"
        description="Aún no hay nada que mostrar."
      />
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Sin elementos")).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("renders children as CTA", () => {
    render(
      <EmptyState title="Sin elementos">
        <button>Crear elemento</button>
      </EmptyState>
    );
    expect(screen.getByRole("button", { name: "Crear elemento" })).toBeInTheDocument();
  });
});
