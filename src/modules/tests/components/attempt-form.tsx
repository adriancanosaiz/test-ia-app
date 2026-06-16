"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  SelectField,
  AccessibleSelectTrigger,
} from "@/components/ui/select-field";
import { FormField } from "@/components/ui/form-field";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createAttempt } from "../actions";
import type { UserAnswer } from "../scoring";
import type { FieldErrors } from "@/lib/errors";
import { CheckCircle2, Loader2, Send, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttemptFormProps {
  testId: string;
  questions: {
    id: string;
    type: string;
    content: string;
    options: { id: string; text: string; index: number }[];
  }[];
  timeLimitMinutes?: number;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function AttemptForm({
  testId,
  questions,
  timeLimitMinutes,
}: AttemptFormProps) {
  const t = useTranslations("tests");
  const router = useRouter();
  const getErrorMessage = useErrorMessage();
  const draftKey = `test-attempt-draft:${testId}`;
  const timerKey = `test-attempt-timer:${testId}`;
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>(() => {
    if (typeof window === "undefined") return {};
    const saved = localStorage.getItem(draftKey);
    if (!saved) return {};
    try {
      return JSON.parse(saved) as Record<string, UserAnswer>;
    } catch {
      localStorage.removeItem(draftKey);
      return {};
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);

  function setMultipleChoice(questionId: string, optionId: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { questionId, selectedOptionId: optionId },
    }));
  }

  function setTrueFalse(questionId: string, value: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { questionId, booleanAnswer: value === "true" },
    }));
  }

  function setShortAnswer(questionId: string, text: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { questionId, textAnswer: text },
    }));
  }

  const handleSubmit = useCallback(
    async (force = false) => {
      setServerError(null);
      setFieldErrors({});

      const unanswered = questions.filter((q) => {
        const a = answers[q.id];
        if (q.type === "MULTIPLE_CHOICE") return !a?.selectedOptionId;
        if (q.type === "TRUE_FALSE") return a?.booleanAnswer === undefined;
        return !a?.textAnswer || a.textAnswer.trim().length === 0;
      });

      if (unanswered.length > 0 && !force) {
        setIsConfirmDialogOpen(true);
        return;
      }

      setIsLoading(true);
      const attemptAnswers = questions.map((q) => {
        const answer = answers[q.id];
        return {
          questionId: q.id,
          selectedOptionId: answer?.selectedOptionId,
          booleanAnswer: answer?.booleanAnswer,
          textAnswer: answer?.textAnswer,
        };
      });

      const result = await createAttempt(testId, attemptAnswers);
      setIsLoading(false);

      if (!result.success) {
        setIsConfirmDialogOpen(false);
        setFieldErrors(result.fieldErrors ?? {});
        if (
          result.error.type === "SYSTEM_ERROR" ||
          Object.keys(result.fieldErrors ?? {}).length === 0
        ) {
          setServerError(getErrorMessage(result.error));
        }
        return;
      }

      localStorage.removeItem(draftKey);
      localStorage.removeItem(timerKey);

      router.push(`/tests/${testId}/attempts/${result.data.id}`);
      router.refresh();
    },
    [answers, questions, testId, router, draftKey, timerKey, getErrorMessage]
  );

  const handleSubmitRef = useRef(handleSubmit);
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify(answers));
  }, [answers, draftKey]);

  useEffect(() => {
    if (!timeLimitMinutes) return;

    let endTime = Number(localStorage.getItem(timerKey));
    const now = Date.now();
    if (!endTime || endTime <= now) {
      endTime = now + timeLimitMinutes * 60 * 1000;
      localStorage.setItem(timerKey, String(endTime));
    }

    function updateTime() {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setTimeLeftSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        void handleSubmitRef.current(true);
      }
    }

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [timeLimitMinutes, timerKey]);

  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    if (q.type === "MULTIPLE_CHOICE") return !!a?.selectedOptionId;
    if (q.type === "TRUE_FALSE") return a?.booleanAnswer !== undefined;
    return a?.textAnswer !== undefined && a.textAnswer.trim().length > 0;
  }).length;

  const answersFieldError = fieldErrors.answers?.[0];
  const unansweredCount = questions.length - answeredCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
        <Progress
          value={answeredCount}
          max={questions.length}
          label={t("attemptProgress")}
          aria-live="polite"
        />
        {timeLimitMinutes !== undefined && timeLeftSeconds !== null && (
          <div
            className={cn(
              "flex items-center gap-2 shrink-0 font-medium tabular-nums",
              timeLeftSeconds <= 60 && "text-destructive"
            )}
            role="timer"
            aria-live="polite"
            aria-label={t("remainingTimeAriaLabel")}
          >
            <Timer className="h-4 w-4" aria-hidden="true" />
            {formatTime(timeLeftSeconds)}
          </div>
        )}
      </div>

      {questions.map((question, index) => (
        <Card key={question.id} className="overflow-hidden">
          <fieldset className="border-0 m-0 p-0">
            <legend className="bg-muted/20 w-full px-6 py-3 text-base leading-relaxed font-medium flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                {index + 1}
              </span>
              {question.content}
            </legend>
            <CardContent className="pt-4">
              {question.type === "MULTIPLE_CHOICE" && (
                <div
                  role="radiogroup"
                  aria-required="true"
                  className="space-y-2"
                >
                  {question.options.map((option) => {
                    const isSelected =
                      answers[question.id]?.selectedOptionId === option.id;
                    const optionId = `question-${question.id}-option-${option.id}`;
                    return (
                      <label
                        key={option.id}
                        htmlFor={optionId}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                          isSelected
                            ? "bg-primary/5 border-primary"
                            : "hover:bg-muted/50 border-border"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          )}
                          aria-hidden="true"
                        >
                          {isSelected && (
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <input
                          id={optionId}
                          type="radio"
                          name={`question-${question.id}`}
                          value={option.id}
                          checked={isSelected}
                          onChange={() =>
                            setMultipleChoice(question.id, option.id)
                          }
                          className="sr-only"
                        />
                        <span>{option.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {question.type === "TRUE_FALSE" && (
                <SelectField label={t("selectTrueFalse")}>
                  <Select
                    value={
                      answers[question.id]?.booleanAnswer === undefined
                        ? ""
                        : String(answers[question.id].booleanAnswer)
                    }
                    onValueChange={(value) =>
                      setTrueFalse(question.id, value ?? "")
                    }
                    items={[
                      { value: "true", label: t("true") },
                      { value: "false", label: t("false") },
                    ]}
                  >
                    <AccessibleSelectTrigger className="w-full">
                      <SelectValue placeholder={t("select")} />
                    </AccessibleSelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">{t("true")}</SelectItem>
                      <SelectItem value="false">{t("false")}</SelectItem>
                    </SelectContent>
                  </Select>
                </SelectField>
              )}

              {question.type === "SHORT_ANSWER" && (
                <FormField
                  id={`answer-${question.id}`}
                  label={t("yourAnswer")}
                >
                  <Textarea
                    id={`answer-${question.id}`}
                    value={answers[question.id]?.textAnswer ?? ""}
                    onChange={(e) =>
                      setShortAnswer(question.id, e.target.value)
                    }
                    placeholder={t("yourAnswerPlaceholder")}
                    disabled={isLoading}
                  />
                </FormField>
              )}
            </CardContent>
          </fieldset>
        </Card>
      ))}

      {(serverError || answersFieldError) && (
        <p
          role="alert"
          className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg"
        >
          {serverError ?? answersFieldError}
        </p>
      )}

      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
        title={t("submitIncompleteTitle")}
        description={
          unansweredCount === 1
            ? t("submitIncompleteDescription", { count: unansweredCount })
            : t("submitIncompleteDescriptionPlural", { count: unansweredCount })
        }
        confirmLabel={t("submitAnyway")}
        cancelLabel={t("keepAnswering")}
        variant="destructive"
        isPending={isLoading}
        onConfirm={() => void handleSubmit(true)}
      />

      <Button
        onClick={() => void handleSubmit()}
        disabled={isLoading}
        aria-busy={isLoading}
        size="lg"
        className="gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("submitting")}
          </>
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden="true" />
            {t("finishTest")}
          </>
        )}
      </Button>
    </div>
  );
}
