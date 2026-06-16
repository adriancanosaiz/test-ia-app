import { config } from "dotenv";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { vi } from "vitest";
import fs from "fs";
import path from "path";
import { resetRateLimitStore } from "@/lib/rate-limit";

config({ path: ".env.test" });

const messagesDir = path.resolve(__dirname, "../../../messages/es");
const messages: Record<string, Record<string, unknown>> = {};

if (fs.existsSync(messagesDir)) {
  for (const file of fs.readdirSync(messagesDir)) {
    if (file.endsWith(".json")) {
      const namespace = file.replace(".json", "");
      const content = fs.readFileSync(path.join(messagesDir, file), "utf-8");
      messages[namespace] = JSON.parse(content);
    }
  }
}

function getNestedValue(
  obj: Record<string, unknown>,
  key: string
): string | undefined {
  const parts = key.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

function translate(namespace: string, key: string): string {
  const value = getNestedValue(messages[namespace] ?? {}, key);
  if (value !== undefined) return value;

  // Fallback: if no namespace is provided, try to resolve "namespace.key"
  const [first, ...rest] = key.split(".");
  if (rest.length > 0) {
    const fallback = getNestedValue(messages[first] ?? {}, rest.join("."));
    if (fallback !== undefined) return fallback;
  }

  return key;
}

function interpolate(
  template: string,
  values?: Record<string, unknown>
): string {
  if (!values) return template;
  return template.replace(/\{([^}]+)\}/g, (_, name) => {
    const value = values[name];
    return value !== undefined && value !== null ? String(value) : `{${name}}`;
  });
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    const t = React.useCallback(
      (key: string, values?: Record<string, unknown>) => {
        const message = namespace
          ? translate(namespace, key)
          : translate(key, "");
        return interpolate(message, values);
      },
      [namespace]
    );
    return t;
  },
  useLocale: () => "es",
  useMessages: () => messages,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

beforeEach(() => {
  resetRateLimitStore();
});
