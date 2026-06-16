// @vitest-environment jsdom

import { describe, it, vi, afterEach, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LogoLink } from "./logo-link";
import { expectNoViolations } from "@/lib/test/a11y";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";

const mockUsePathname = vi.mocked(usePathname);

describe("LogoLink", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("links to home when on the landing page", async () => {
    mockUsePathname.mockReturnValue("/");
    const { container } = render(<LogoLink />);

    expect(screen.getByRole("link", { name: "TestForge" })).toHaveAttribute(
      "href",
      "/"
    );
    await expectNoViolations(container);
  });

  it("links to dashboard on any other page", async () => {
    mockUsePathname.mockReturnValue("/dashboard");
    const { container } = render(<LogoLink />);

    expect(screen.getByRole("link", { name: "TestForge" })).toHaveAttribute(
      "href",
      "/dashboard"
    );
    await expectNoViolations(container);
  });
});
