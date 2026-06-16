import { headers } from "next/headers";
import { ActionResult, createUserError } from "./errors";

type RateLimitEntry = {
  timestamps: number[];
};

const store = new Map<string, RateLimitEntry>();

function getKey(identifier: string, action: string): string {
  return `${identifier}:${action}`;
}

export function checkRateLimit(
  identifier: string,
  action: string,
  windowMs: number,
  maxRequests: number
): ActionResult<void> {
  const now = Date.now();
  const key = getKey(identifier, action);
  const entry = store.get(key) ?? { timestamps: [] };

  const cutoff = now - windowMs;
  const validTimestamps = entry.timestamps.filter(
    (timestamp) => timestamp > cutoff
  );

  if (validTimestamps.length >= maxRequests) {
    const oldest = validTimestamps[0] ?? now;
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);

    return {
      success: false,
      error: createUserError(
        `Has alcanzado el límite de peticiones. Inténtalo de nuevo en ${retryAfter}s.`,
        "RATE_LIMITED"
      ),
    };
  }

  validTimestamps.push(now);
  store.set(key, { timestamps: validTimestamps });

  return { success: true, data: undefined };
}

export function resetRateLimitStore(): void {
  store.clear();
}

export async function getClientIp(): Promise<string> {
  try {
    const requestHeaders = await headers();
    const forwarded = requestHeaders.get("x-forwarded-for");

    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }

    const realIp = requestHeaders.get("x-real-ip");
    if (realIp) {
      return realIp.trim();
    }
  } catch {
    // headers() solo está disponible en Server Components / Server Actions.
    // En tests u otros contextos usamos un valor por defecto.
  }

  return "unknown";
}
