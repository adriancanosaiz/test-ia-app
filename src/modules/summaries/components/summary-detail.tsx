"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { retrySummary, cancelSummaryGeneration } from "../actions";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

interface SummaryDetailProps {
  id: string;
  documentStatus: string;
  content: string;
  status: string;
  progress: number;
  errorMessage: string | null;
  createdAt: Date;
}

interface SummarySnapshot {
  status: string;
  progress: number;
  errorMessage: string | null;
  content: string;
}

const markdownComponents = {
  h1: "h2",
  h2: "h3",
  h3: "h4",
  h4: "h5",
  h5: "h6",
  h6: "p",
} as const;

export function SummaryDetail({
  id,
  documentStatus,
  content,
  status,
  progress,
  errorMessage,
  createdAt,
}: SummaryDetailProps) {
  const t = useTranslations("summaries");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [sseData, setSseData] = useState<SummarySnapshot | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const summary = useMemo<SummarySnapshot>(
    () =>
      sseData ?? {
        status,
        progress,
        errorMessage,
        content,
      },
    [sseData, status, progress, errorMessage, content]
  );

  useEffect(() => {
    if (summary.status !== "PROCESSING") return;

    const eventSource = new EventSource(`/api/summaries/${id}/progress`);
    eventSourceRef.current = eventSource;

    function handleProgressPayload(
      data: {
        status: string;
        progress: number;
        errorMessage: string | null;
      },
      shouldRefresh: boolean
    ): void {
      setSseData((prev) => ({
        status: data.status,
        progress: data.progress,
        errorMessage: data.errorMessage,
        content: prev?.content ?? content,
      }));

      if (shouldRefresh) {
        router.refresh();
      }
    }

    eventSource.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse(event.data) as {
          status: string;
          progress: number;
          errorMessage: string | null;
        };

        handleProgressPayload(
          data,
          data.status === "READY" || data.status === "ERROR"
        );

        if (data.status === "READY" || data.status === "ERROR") {
          eventSource.close();
        }
      } catch {
        // Ignorar eventos malformados
      }
    });

    eventSource.addEventListener("complete", (event) => {
      try {
        const data = JSON.parse(event.data) as {
          status: string;
          progress: number;
          errorMessage: string | null;
        };
        handleProgressPayload(data, true);
      } catch {
        // Ignorar eventos malformados
      }
      eventSource.close();
    });

    eventSource.addEventListener("error", (event) => {
      if (event instanceof MessageEvent && typeof event.data === "string") {
        try {
          const data = JSON.parse(event.data) as { message: string; code?: string };
          if (typeof data.message === "string") {
            setSseData((prev) => ({
              status: "ERROR",
              progress: prev?.progress ?? progress,
              errorMessage: data.message,
              content: prev?.content ?? content,
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
  }, [id, summary.status, content, progress, router]);

  async function handleRetry() {
    setIsRetrying(true);
    const result = await retrySummary(id);
    setIsRetrying(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("retryError"),
        description: getErrorMessage(result.error),
      });
      return;
    }

    toast({
      variant: "success",
      title: t("retryInProgress"),
      description: t("retryQueued"),
    });

    router.refresh();
  }

  async function handleCancel() {
    setIsCancelling(true);
    eventSourceRef.current?.close();
    eventSourceRef.current = null;

    const result = await cancelSummaryGeneration(id);
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

  const isRetryDisabled = documentStatus !== "READY" || isRetrying;

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <CardTitle as="h2">{t("title")}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              summary.status === "READY"
                ? "default"
                : summary.status === "ERROR"
                  ? "destructive"
                  : "default"
            }
            className={cn(
              "gap-1.5",
              summary.status === "PROCESSING" && "animate-pulse"
            )}
          >
            {summary.status === "READY" && (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {summary.status === "ERROR" && (
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {summary.status === "PROCESSING" && (
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
            )}
            {summary.status === "READY"
              ? t("statusReady")
              : summary.status === "ERROR"
                ? t("statusError")
                : t("statusProcessing")}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(createdAt))}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.status === "PROCESSING" && (
          <div className="space-y-2">
            <Progress
              value={summary.progress}
              max={100}
              label={t("progressLabel")}
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
              <X className="h-4 w-4" aria-hidden="true" />
              {tc("cancel")}
            </Button>
          </div>
        )}

        {summary.status === "ERROR" && (
          <div className="space-y-3">
            <div
              role="alert"
              className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-4 py-3 rounded-xl"
            >
              <AlertCircle
                className="h-4 w-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">{t("errorTitle")}</p>
                {summary.errorMessage && (
                  <p className="mt-1">{summary.errorMessage}</p>
                )}
              </div>
            </div>
            <Button
              onClick={handleRetry}
              disabled={isRetryDisabled}
              variant="outline"
              className="gap-1"
              aria-label={t("retryAria")}
              title={
                documentStatus !== "READY"
                  ? t("documentRequiredTooltip")
                  : undefined
              }
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              {tc("retry")}
            </Button>
          </div>
        )}

        {summary.status === "READY" && (
          <article
            className="prose dark:prose-invert max-w-none"
            aria-label={t("contentAria")}
          >
            <ReactMarkdown
              rehypePlugins={[rehypeSanitize]}
              components={markdownComponents}
            >
              {summary.content}
            </ReactMarkdown>
          </article>
        )}
      </CardContent>
    </Card>
  );
}
