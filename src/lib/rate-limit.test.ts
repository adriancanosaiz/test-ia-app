import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, resetRateLimitStore } from "./rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRateLimitStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite las peticiones dentro del límite", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit("ip", "uploadDocument", 60_000, 5);
      expect(result.success).toBe(true);
    }
  });

  it("bloquea cuando se supera el límite", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("ip", "uploadDocument", 60_000, 5).success).toBe(
        true
      );
    }

    const result = checkRateLimit("ip", "uploadDocument", 60_000, 5);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("USER_ERROR");
      expect(result.error.code).toBe("RATE_LIMITED");
      expect(result.error.message).toMatch(/Inténtalo de nuevo en \d+s/);
    }
  });

  it("reinicia el contador tras la ventana deslizante", () => {
    const now = Date.now();

    for (let i = 0; i < 5; i++) {
      checkRateLimit("ip", "uploadDocument", 60_000, 5);
    }

    expect(checkRateLimit("ip", "uploadDocument", 60_000, 5).success).toBe(
      false
    );

    vi.setSystemTime(now + 60_001);

    const result = checkRateLimit("ip", "uploadDocument", 60_000, 5);
    expect(result.success).toBe(true);
  });

  it("calcula el tiempo de espera en función de la petición más antigua", () => {
    const now = Date.now();

    for (let i = 0; i < 5; i++) {
      checkRateLimit("ip", "uploadDocument", 60_000, 5);
    }

    vi.setSystemTime(now + 30_000);

    const result = checkRateLimit("ip", "uploadDocument", 60_000, 5);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/Inténtalo de nuevo en 30s/);
    }
  });

  it("cuenta de forma independiente por acción", () => {
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit("ip", "createTest", 60_000, 10).success).toBe(true);
    }

    expect(checkRateLimit("ip", "createTest", 60_000, 10).success).toBe(false);
    expect(checkRateLimit("ip", "addUserMessage", 60_000, 30).success).toBe(
      true
    );
  });

  it("cuenta de forma independiente por identificador", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("ip-a", "uploadDocument", 60_000, 5);
    }

    expect(checkRateLimit("ip-a", "uploadDocument", 60_000, 5).success).toBe(
      false
    );
    expect(checkRateLimit("ip-b", "uploadDocument", 60_000, 5).success).toBe(
      true
    );
  });
});
