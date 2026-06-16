"use client";

import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const recoverablePatterns = [
  /network/i,
  /failed to fetch/i,
  /timeout/i,
  /abort/i,
  /temporary/i,
];

const nonRecoverablePatterns = [
  /not found/i,
  /cannot find module/i,
  /invalid hook call/i,
  /undefined is not a function/i,
];

function isRecoverableError(error: Error & { digest?: string }): boolean {
  if (nonRecoverablePatterns.some((pattern) => pattern.test(error.message))) {
    return false;
  }
  if (recoverablePatterns.some((pattern) => pattern.test(error.message))) {
    return true;
  }
  return error.digest !== undefined;
}

function looksLikeSystemError(message: string): boolean {
  const systemPatterns = [
    /prisma/i,
    /ollama/i,
    /database/i,
    /connection/i,
    /timeout/i,
    /internal server error/i,
    /failed to fetch/i,
    /network/i,
  ];
  return systemPatterns.some((pattern) => pattern.test(message));
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const t = useTranslations("errors");
  const recoverable = isRecoverableError(error);
  const showMessage = error.message && !looksLikeSystemError(error.message);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-6">
        <AlertCircle
          className="h-8 w-8 text-destructive"
          aria-hidden="true"
        />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">
        {t("title")}
      </h1>
      <p className="text-muted-foreground max-w-md mb-8">
        {recoverable
          ? t("recoverableDescription")
          : t("nonRecoverableDescription")}
      </p>
      {showMessage && (
        <p className="text-sm text-muted-foreground mb-4 max-w-md break-words">
          {error.message}
        </p>
      )}
      {error.digest && (
        <p className="text-xs text-muted-foreground mb-8">
          {t("referenceCode")}: {error.digest}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        {recoverable ? (
          <Button onClick={reset} variant="outline">
            {t("tryAgain")}
          </Button>
        ) : null}
        <LinkButton href="/dashboard">{t("backToDashboard")}</LinkButton>
      </div>
    </div>
  );
}
