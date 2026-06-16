// @vitest-environment jsdom

import { describe, it, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import DashboardLoading from "./loading";
import { expectNoViolations } from "@/lib/test/a11y";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => {
      const messages: Record<string, string> = {
        loading: "Cargando dashboard",
      };
      return messages[key] ?? key;
    })
  ),
}));

describe("DashboardLoading", () => {
  afterEach(cleanup);

  it("renders skeleton loaders and has no accessibility violations", async () => {
    const { container } = render(await DashboardLoading());

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByLabelText(/Cargando dashboard/i)).toBeInTheDocument();

    await expectNoViolations(container);
  });
});
