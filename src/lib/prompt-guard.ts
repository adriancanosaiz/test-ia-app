const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+|your\s+|the\s+)?previous\s+instructions/i,
  /ignore\s+(?:the\s+)?system\s+prompt/i,
  /system\s+prompt/i,
  /\bDAN\b/i,
  /jailbreak/i,
  /bypass\s+(?:restrictions|safety|filters)/i,
  /do\s+anything\s+now/i,
  /you\s+are\s+not\s+(?:an?\s+)?(?:AI|assistant|language\s+model)/i,
  /from\s+now\s+on\s+you/i,
  /pretend\s+(?:to\s+be|you\s+are)/i,
  /hacked\s+mode/i,
  /developer\s+mode/i,
  /evil\s+mode/i,
  /ignore\s+(?:the\s+)?(?:above|below)/i,
  /new\s+instructions?/i,
  /disregard\s+(?:all\s+|your\s+)?instructions/i,
];

export function detectPromptInjection(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }

  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}
