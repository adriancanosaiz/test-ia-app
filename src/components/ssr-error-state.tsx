"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface SsrErrorStateProps {
  title?: string;
  description?: string;
}

export function SsrErrorState({
  title,
  description,
}: SsrErrorStateProps) {
  const router = useRouter();
  const t = useTranslations("errors");
  const tc = useTranslations("common");

  return (
    <EmptyState
      icon={AlertTriangle}
      title={title ?? t("ssrErrorTitle")}
      description={description ?? t("ssrErrorDescription")}
      className="my-12"
    >
      <Button
        onClick={() => router.refresh()}
        className="gap-2"
        aria-label={t("retryLoading")}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        {tc("retry")}
      </Button>
    </EmptyState>
  );
}
