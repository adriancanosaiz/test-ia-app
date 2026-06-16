// @vitest-environment jsdom

import { describe, it, vi, afterEach, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NavLink } from "./nav-link";
import { expectNoViolations } from "@/lib/test/a11y";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";

const mockUsePathname = vi.mocked(usePathname);

describe("NavLink", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders as a link and has no accessibility violations", async () => {
    mockUsePathname.mockReturnValue("/chat");
    const { container } = render(<NavLink href="/dashboard">Dashboard</NavLink>);

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it("marks the current page when active", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    render(<NavLink href="/dashboard">Dashboard</NavLink>);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
