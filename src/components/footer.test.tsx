// @vitest-environment jsdom

import { describe, it, afterEach, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Footer } from "./footer";
import { expectNoViolations } from "@/lib/test/a11y";

const messages = {
  navigation: {
    copyright: "© {year} TestForge. IA 100% local.",
    footerLinks: "Enlaces del pie",
    dashboard: "Dashboard",
    chat: "Chat",
    tests: "Tests",
  },
};

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("Footer", () => {
  afterEach(cleanup);

  it("renders copyright, navigation links and has no accessibility violations", async () => {
    const { container } = renderWithProvider(<Footer />);

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText(/TestForge/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chat" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tests" })).toBeInTheDocument();
    await expectNoViolations(container);
  });
});
