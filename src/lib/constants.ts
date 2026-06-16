export const RATE_LIMITS = {
  uploadDocument: { windowMs: 60_000, maxRequests: 5 },
  createTest: { windowMs: 60_000, maxRequests: 10 },
  addUserMessage: { windowMs: 60_000, maxRequests: 30 },
} as const;

export type RateLimitAction = keyof typeof RATE_LIMITS;
