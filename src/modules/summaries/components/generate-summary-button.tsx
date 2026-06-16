"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button } from "@/components/ui/button";
import { ScrollText, Loader2 } from "lucide-react";
import { generateSummary } from "@/modules/summaries/actions";
import { useToast } from "@/hooks/use-toast";

interface GenerateSummaryButtonProps {
  documentId: string;
  status: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  label?: string;
}

export function GenerateSummaryButton({
  documentId,
  status,
  variant = "default",
  size = "default",
  label,
}: GenerateSummaryButtonProps) {
  const t = useTranslations("summaries");
  const router = useRouter();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [isPending, setIsPending] = useState(false);

  const buttonLabel = label ?? t("generateLabel");
  const isDisabled = status !== "READY" || isPending;

  async function handleClick() {
    setIsPending(true);
    const result = await generateSummary(documentId);
    setIsPending(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("generateError"),
        description: getErrorMessage(result.error),
      });
      return;
    }

    toast({
      variant: "success",
      title: t("summaryInProgress"),
      description: t("summaryQueued"),
    });

    router.refresh();
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isDisabled}
      variant={variant}
      size={size}
      aria-label={buttonLabel}
      title={
        status !== "READY"
          ? t("documentRequiredTooltip")
          : undefined
      }
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <ScrollText className="h-4 w-4" aria-hidden="true" />
      )}
      {buttonLabel}
    </Button>
  );
}
