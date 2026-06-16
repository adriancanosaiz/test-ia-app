// @vitest-environment jsdom

import { describe, it, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import HomePage from "./page";
import { expectNoViolations } from "@/lib/test/a11y";
import landingMessages from "../../messages/es/landing.json";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn((namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      landing: landingMessages,
    };
    return Promise.resolve((key: string) => messages[namespace]?.[key] ?? key);
  }),
  getMessages: vi.fn(() => Promise.resolve({})),
}));

describe("HomePage", () => {
  afterEach(cleanup);

  it("renders main headings and has no accessibility violations", async () => {
    const { container } = render(await HomePage());
    expect(
      screen.getByRole("heading", { name: /Estudia con IA/i, level: 1 })
    ).toBeInTheDocument();
    await expectNoViolations(container);
  });
});
