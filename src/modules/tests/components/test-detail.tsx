"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { retryGenerateTest, cancelTestGeneration } from "../actions";
import { useToast } from "@/hooks/use-toast";

export interface TestDetailProps {
  test: {
    id: string;
    title: string;
    difficulty: string;
    questionType: string;
    questionCount: number;
    sourceLabel: string;
    sourceName: string;
    status: string;
    progress: number;
    errorMessage: string | null;
    questions: {
      id: string;
      content: string;
      explanation: string | null;
      isCorrect: boolean | null;
      modelAnswer: string | null;
      options: { id: string; text: string; isCorrect: boolean; index: number }[];
    }[];
  };
}

function getQuestionTypeLabel(type: string, t: (key: string) => string) {
  switch (type) {
    case "MULTIPLE_CHOICE":
      return t("multipleChoice");
    case "TRUE_FALSE":
      return t("trueFalse");
    case "SHORT_ANSWER":
      return t("shortAnswer");
    default:
      return type;
  }
}

function getDifficultyLabel(difficulty: string, t: (key: string) => string) {
  switch (difficulty) {
    case "EASY":
      return t("difficultyEasy");
    case "MEDIUM":
      return t("difficultyMedium");
    case "HARD":
      return t("difficultyHard");
    default:
      return difficulty;
  }
}

export function TestDetail({ test }: TestDetailProps) {
  const t = useTranslations("tests");
  const router = useRouter();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [progress, setProgress] = useState(test.progress);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (test.status !== "PROCESSING") {
      return;
    }

    const eventSource = new EventSource(`/api/tests/${test.id}/progress`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as {
          status: string;
          progress: number;
          errorMessage: string | null;
        };

        setProgress(data.progress);

        if (data.status === "READY" || data.status === "ERROR") {
          eventSource.close();
          router.refresh();
        }
      } catch {
        // Ignore malformed events.
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
            setProgress(0);
          }
        } catch {
          // Ignore malformed error events.
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
  }, [test.status, test.id, router]);

  async function handleRetry() {
    setIsRetrying(true);
    const result = await retryGenerateTest(test.id);
    setIsRetrying(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("errorOccurred"),
        description: getErrorMessage(result.error),
      });
      return;
    }

    router.refresh();
  }

  async function handleCancel() {
    setIsCancelling(true);
    eventSourceRef.current?.close();
    eventSourceRef.current = null;

    const result = await cancelTestGeneration(test.id);
    setIsCancelling(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("toastDeleteError"),
        description: getErrorMessage(result.error),
      });
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          {t("testInfo", {
            count: test.questionCount,
            type: getQuestionTypeLabel(test.questionType, t),
            difficulty: getDifficultyLabel(test.difficulty, t),
          })}
        </p>
        <p>
          {t("sourceLabel", { label: test.sourceLabel, name: test.sourceName })}
        </p>
      </div>

      {(test.status === "PROCESSING" || isRetrying) && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2
              className="h-4 w-4 animate-spin text-primary"
              aria-hidden="true"
            />
            {isRetrying ? t("retryingGeneration") : t("generatingQuestions")}
          </div>
          {!isRetrying && (
            <Progress
              value={progress}
              max={100}
              label={t("generationProgress")}
              aria-live="polite"
            />
          )}
          {!isRetrying && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              aria-label={t("cancelGenerationAriaLabel")}
              disabled={isCancelling}
              onClick={() => void handleCancel()}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {t("cancel")}
            </Button>
          )}
        </div>
      )}

      {test.status === "ERROR" && !isRetrying && (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50"
        >
          <div className="flex items-start gap-2 text-sm text-red-800 dark:text-red-100">
            <AlertCircle
              className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="font-medium">{t("errorOccurred")}</p>
              <p className="text-red-700 dark:text-red-200">
                {test.errorMessage ?? t("questionsGenerationError")}
              </p>
            </div>
          </div>
          <Button
            onClick={handleRetry}
            disabled={isRetrying}
            variant="outline"
            className="border-red-200 bg-white hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900"
          >
            {isRetrying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("retrying")}
              </>
            ) : (
              t("retry")
            )}
          </Button>
        </div>
      )}

      {test.status === "READY" && test.questions.length === 0 && (
        <div role="status" className="text-sm text-muted-foreground">
          {t("noQuestionsVisible")}
        </div>
      )}

      {test.questions.length > 0 && (
        <div className="space-y-4">
          {test.questions.map((question, index) => (
            <Card key={question.id}>
              <CardHeader>
                <CardTitle as="h3" className="text-base">
                  {index + 1}. {question.content}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {question.options.length > 0 && (
                  <ul className="space-y-2" aria-label={t("answerOptions")}>
                    {question.options.map((option) => (
                      <li
                        key={option.id}
                        className={`p-2 rounded border text-sm flex items-center justify-between ${
                          option.isCorrect
                            ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-900"
                            : "border-border"
                        }`}
                      >
                        <span>{option.text}</span>
                        {option.isCorrect && (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium">
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            {t("correct")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {test.questionType === "TRUE_FALSE" && (
                  <p className="text-sm">
                    {t("correctAnswer", {
                      answer: question.isCorrect ? t("true") : t("false"),
                    })}
                  </p>
                )}
                {test.questionType === "SHORT_ANSWER" && question.modelAnswer && (
                  <p className="text-sm">
                    {t("modelAnswer", { answer: question.modelAnswer })}
                  </p>
                )}
                {question.explanation && (
                  <CardDescription>
                    {t("explanation", { explanation: question.explanation })}
                  </CardDescription>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
