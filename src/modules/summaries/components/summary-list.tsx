"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { deleteSummary, cancelSummaryGeneration } from "../actions";
import { GenerateSummaryButton } from "./generate-summary-button";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2,
  ScrollText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SummaryItem {
  id: string;
  content: string;
  status: string;
  progress: number;
  errorMessage: string | null;
  createdAt: Date;
}

interface SummaryListProps {
  documentId: string;
  documentStatus: string;
  summaries: SummaryItem[];
}

function useStatusConfig() {
  const t = useTranslations("summaries");
  return {
    PROCESSING: { label: t("statusProcessing"), icon: Loader2, variant: "default" as const },
    READY: { label: t("statusReady"), icon: CheckCircle2, variant: "default" as const },
    ERROR: { label: t("statusError"), icon: AlertCircle, variant: "destructive" as const },
  };
}

function SummaryListItem({
  documentId,
  initialSummary,
}: {
  documentId: string;
  initialSummary: SummaryItem;
}) {
  const t = useTranslations("summaries");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [localSummary, setLocalSummary] =
    useState<SummaryItem>(initialSummary);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [summaryToDelete, setSummaryToDelete] = useState<SummaryItem | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const summary = useMemo<SummaryItem>(() => {
    if (
      localSummary.status === "READY" ||
      localSummary.status === "ERROR"
    ) {
      return localSummary;
    }
    if (
      initialSummary.status === "READY" ||
      initialSummary.status === "ERROR"
    ) {
      return initialSummary;
    }
    return {
      ...initialSummary,
      status: localSummary.status,
      progress: localSummary.progress,
      errorMessage: localSummary.errorMessage,
    };
  }, [initialSummary, localSummary]);

  useEffect(() => {
    if (summary.status !== "PROCESSING") return;

    const eventSource = new EventSource(
      `/api/summaries/${summary.id}/progress`
    );
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse(event.data) as {
          status: string;
          progress: number;
          errorMessage: string | null;
        };

        setLocalSummary((prev) => ({ ...prev, ...data }));

        if (data.status === "READY" || data.status === "ERROR") {
          eventSource.close();
          router.refresh();
        }
      } catch {
        // Ignorar eventos malformados
      }
    });

    eventSource.addEventListener("complete", () => {
      eventSource.close();
      router.refresh();
    });

    eventSource.addEventListener("error", (event) => {
      if (event instanceof MessageEvent && typeof event.data === "string") {
        try {
          const data = JSON.parse(event.data) as { message: string; code?: string };
          if (typeof data.message === "string") {
            setLocalSummary((prev) => ({
              ...prev,
              status: "ERROR",
              errorMessage: data.message,
            }));
          }
        } catch {
          // Ignorar eventos de error malformados
        }
      }
      eventSource.close();
      router.refresh();
    });

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [summary.id, summary.status, router]);

  function handleDeleteRequest(summaryItem: SummaryItem) {
    setSummaryToDelete(summaryItem);
    setIsDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!summaryToDelete) return;

    setIsDeleting(true);
    const result = await deleteSummary(summaryToDelete.id);
    setIsDeleting(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("deleteError"),
        description: getErrorMessage(result.error),
      });
      return;
    }

    setIsDeleteDialogOpen(false);
    router.refresh();
  }

  async function handleCancel() {
    setIsCancelling(true);
    eventSourceRef.current?.close();
    eventSourceRef.current = null;

    const result = await cancelSummaryGeneration(summary.id);
    setIsCancelling(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("cancelError"),
        description: getErrorMessage(result.error),
      });
      return;
    }

    router.refresh();
  }

  function handleOpenDetail() {
    if (summary.status === "READY") {
      router.push(`/documents/${documentId}/summaries/${summary.id}`);
    }
  }

  const statusConfig = useStatusConfig();
  const status = statusConfig[summary.status as keyof typeof statusConfig] ?? {
    label: summary.status,
    icon: Clock,
    variant: "secondary" as const,
  };
  const StatusIcon = status.icon;

  return (
    <li key={summary.id}>
      <Card className="overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-in">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground">
                {t("summaryTitle", {
                  date: new Intl.DateTimeFormat(locale, {
                    dateStyle: "long",
                  }).format(new Date(summary.createdAt)),
                })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {new Intl.DateTimeFormat(locale, {
                  timeStyle: "short",
                }).format(new Date(summary.createdAt))}
              </p>
            </div>
            <Badge
              variant={status.variant}
              className={cn(
                "shrink-0 gap-1.5",
                summary.status === "PROCESSING" && "animate-pulse"
              )}
            >
              <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {status.label}
            </Badge>
          </div>

          {summary.status === "PROCESSING" && (
            <div className="mt-3 space-y-2">
              <Progress
                value={summary.progress}
                max={100}
                label={t("progressLabel")}
                aria-live="polite"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                aria-label={t("cancelGenerationAria")}
                disabled={isCancelling}
                onClick={() => void handleCancel()}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                {tc("cancel")}
              </Button>
            </div>
          )}

          {summary.status === "ERROR" && summary.errorMessage && (
            <p
              role="alert"
              className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-3 py-2 rounded-md"
            >
              {summary.errorMessage}
            </p>
          )}

          {summary.status === "READY" && summary.content && (
            <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
              {summary.content}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {summary.status === "READY" && (
              <Button
                size="sm"
                variant="secondary"
                className="gap-1"
                onClick={handleOpenDetail}
                aria-label={t("viewSummaryAria")}
              >
                {t("viewSummary")}
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              className="gap-1"
              aria-label={t("deleteSummaryAria")}
              onClick={() => handleDeleteRequest(summary)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {tc("delete")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={t("deleteDialogTitle")}
        description={t("deleteDialogDescription")}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        variant="destructive"
        isPending={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </li>
  );
}

export function SummaryList({
  documentId,
  documentStatus,
  summaries,
}: SummaryListProps) {
  const t = useTranslations("summaries");

  if (summaries.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      >
        <GenerateSummaryButton
          documentId={documentId}
          status={documentStatus}
        />
      </EmptyState>
    );
  }

  return (
    <ul className="space-y-3" aria-label={t("listAria")}>
      {summaries.map((summary) => (
        <SummaryListItem
          key={summary.id}
          documentId={documentId}
          initialSummary={summary}
        />
      ))}
    </ul>
  );
}
