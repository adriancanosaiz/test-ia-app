// @vitest-environment jsdom

import { describe, it, vi, afterEach, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AttemptList } from "./attempt-list";
import { expectNoViolations } from "@/lib/test/a11y";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const attempts = [
  {
    id: "attempt-1",
    score: 80,
    startedAt: new Date("2024-01-01T10:00:00"),
    finishedAt: new Date("2024-01-01T10:05:00"),
  },
  {
    id: "attempt-2",
    score: 60,
    startedAt: new Date("2024-01-02T10:00:00"),
    finishedAt: new Date("2024-01-02T10:05:00"),
  },
];

describe("AttemptList", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("muestra empty state accesible cuando no hay intentos", async () => {
    const { container } = render(
      <AttemptList testId="test-1" attempts={[]} />
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Aún no hay intentos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hacer test" })).toHaveAttribute(
      "href",
      "/tests/test-1/attempt"
    );
    await expectNoViolations(container);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <AttemptList testId="test-1" attempts={attempts} />
    );
    await expectNoViolations(container);
  });

  it("numera el primer intento como #1", () => {
    render(<AttemptList testId="test-1" attempts={attempts} />);

    const items = screen.getAllByText(/Intento #\d+/);
    expect(items[0]).toHaveTextContent("Intento #2");
    expect(items[1]).toHaveTextContent("Intento #1");
  });

  it("muestra el estado sin calificar cuando no hay nota", () => {
    render(
      <AttemptList
        testId="test-1"
        attempts={[
          {
            id: "attempt-3",
            score: null,
            startedAt: new Date("2024-01-03T10:00:00"),
            finishedAt: null,
          },
        ]}
      />
    );

    expect(screen.getByText("Sin calificar")).toBeInTheDocument();
  });
});
