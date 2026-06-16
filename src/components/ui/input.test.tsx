// @vitest-environment jsdom

import { describe, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Input } from "./input";
import { Label } from "./label";
import { expectNoViolations } from "@/lib/test/a11y";

describe("Input", () => {
  afterEach(cleanup);

  it("has no accessibility violations when labelled", async () => {
    const { container } = render(
      <>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" />
      </>
    );
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    await expectNoViolations(container);
  });
});
