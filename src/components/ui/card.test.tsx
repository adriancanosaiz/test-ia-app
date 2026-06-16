// @vitest-environment jsdom

import { describe, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./card";
import { expectNoViolations } from "@/lib/test/a11y";

describe("Card", () => {
  afterEach(cleanup);

  it("has no accessibility violations", async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle as="h2">Título</CardTitle>
          <CardDescription>Descripción</CardDescription>
        </CardHeader>
        <CardContent>Contenido</CardContent>
      </Card>
    );
    expect(screen.getByRole("heading", { name: "Título" })).toBeInTheDocument();
    await expectNoViolations(container);
  });
});
