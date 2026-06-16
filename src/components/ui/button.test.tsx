// @vitest-environment jsdom

import { describe, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Button } from "./button";
import { expectNoViolations } from "@/lib/test/a11y";

describe("Button", () => {
  afterEach(cleanup);

  it("has no accessibility violations", async () => {
    const { container } = render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("supports disabled state", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
  });
});
