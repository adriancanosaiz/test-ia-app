// @vitest-environment jsdom

import { describe, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Badge } from "./badge";
import { expectNoViolations } from "@/lib/test/a11y";

describe("Badge", () => {
  afterEach(cleanup);

  it("has no accessibility violations", async () => {
    const { container } = render(<Badge>Label</Badge>);
    expect(screen.getByText("Label")).toBeInTheDocument();
    await expectNoViolations(container);
  });
});
