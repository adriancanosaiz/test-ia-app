"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { LinkButton } from "@/components/ui/link-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { gradeShortAnswer } from "../actions";
import { calculateAttemptStats } from "../scoring";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircleIcon,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AttemptDetailProps {
  attempt: {
    id: string;
    score: number | null;
    startedAt: Date;
    finishedAt: Date | null;
    test: {
      id: string;
      title: string;
      questions: {
        id: string;
        content: string;
        type: string;
        explanation: string | null;
        isCorrect: boolean | null;
        modelAnswer: string | null;
        options: {
          id: string;
          text: string;
          isCorrect: boolean;
          index: number;
        }[];
      }[];
    };
    answers: {
      id: string;
      questionId: string;
      selectedOptionId: string | null;
      booleanAnswer: boolean | null;
      textAnswer: string | null;
      isCorrect: boolean | null;
    }[];
  };
  number?: number;
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

function ResultBadge({
  id,
  isCorrect,
  t,
}: {
  id: string;
  isCorrect: boolean | null;
  t: (key: string) => string;
}) {
  if (isCorrect === null) {
    return (
      <Badge
        id={id}
        variant="outline"
        className="gap-1 bg-muted text-muted-foreground"
        aria-label={t("ungradedAriaLabel")}
      >
        <HelpCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {t("ungraded")}
      </Badge>
    );
  }
  if (isCorrect) {
    return (
      <Badge
        id={id}
        className="gap-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-transparent"
        aria-label={t("correctAriaLabel")}
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        {t("correct")}
      </Badge>
    );
  }
  return (
    <Badge
      id={id}
      className="gap-1 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-transparent"
      aria-label={t("incorrectAriaLabel")}
    >
      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
      {t("incorrect")}
    </Badge>
  );
}

export function AttemptDetail({ attempt, number }: AttemptDetailProps) {
  const t = useTranslations("tests");
  const locale = useLocale();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [localAttempt, setLocalAttempt] = useState(attempt);
  const [gradingAnswerId, setGradingAnswerId] = useState<string | null>(null);

  const stats = calculateAttemptStats(
    localAttempt.answers,
    localAttempt.test.questions
  );

  const scoreClass =
    localAttempt.score === null
      ? "text-muted-foreground"
      : localAttempt.score >= 80
      ? "text-green-600 dark:text-green-400"
      : localAttempt.score >= 50
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600 dark:text-red-400";

  async function handleGrade(answerId: string, isCorrect: boolean) {
    setGradingAnswerId(answerId);
    const result = await gradeShortAnswer({
      attemptId: localAttempt.id,
      answerId,
      isCorrect,
    });
    setGradingAnswerId(null);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("gradeError"),
        description: getErrorMessage(result.error),
      });
      return;
    }

    setLocalAttempt((prev) => ({
      ...prev,
      score: result.data.score,
      answers: prev.answers.map((a) =>
        a.id === answerId ? { ...a, isCorrect } : a
      ),
    }));
  }

  return (
    <div className="space-y-6">
      <section aria-label={t("attemptResultAriaLabel")}>
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {localAttempt.test.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {number !== undefined
                    ? t("attemptNumberDate", {
                        number,
                        date: new Intl.DateTimeFormat(locale, {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(localAttempt.startedAt)),
                      })
                    : new Intl.DateTimeFormat(locale, {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(localAttempt.startedAt))}
                </p>
              </div>
              <div className="text-right">
                <p className={cn("text-4xl font-extrabold", scoreClass)}>
                  {localAttempt.score !== null
                    ? `${localAttempt.score}%`
                    : "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {localAttempt.score !== null
                    ? t("scoreStats", {
                        correct: stats.correct,
                        gradedCount: stats.gradedCount,
                        autoGradableCorrect: stats.autoGradableCorrect,
                        autoGradableTotal: stats.autoGradableTotal,
                      })
                    : t("ungraded")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="space-y-4">
        {localAttempt.test.questions.map((question, index) => {
          const answer = localAttempt.answers.find(
            (a) => a.questionId === question.id
          );
          const resultId = `result-${question.id}`;
          const isShortAnswer = question.type === "SHORT_ANSWER";
          return (
            <section key={question.id} aria-label={t("questionAriaLabel", { number: index + 1 })}>
              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <CardTitle
                        as="h3"
                        className="text-base leading-relaxed"
                        aria-describedby={resultId}
                      >
                        {index + 1}. {question.content}
                      </CardTitle>
                      <CardDescription>{getQuestionTypeLabel(question.type, t)}</CardDescription>
                    </div>
                    <ResultBadge
                      id={resultId}
                      isCorrect={answer?.isCorrect ?? null}
                      t={t}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {question.type === "MULTIPLE_CHOICE" && (
                    <ul className="space-y-2" aria-label={t("answerOptions")}>
                      {question.options.map((option) => {
                        const isSelected = answer?.selectedOptionId === option.id;
                        return (
                          <li
                            key={option.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border text-sm",
                              option.isCorrect
                                ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-900"
                                : isSelected
                                ? "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900"
                                : "border-border bg-muted/20"
                            )}
                          >
                            <span>{option.text}</span>
                            <div className="flex items-center gap-2">
                              {option.isCorrect && (
                                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                  {t("correct")}
                                </span>
                              )}
                              {isSelected && !option.isCorrect && (
                                <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                  {t("yourAnswer")}
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {question.type === "TRUE_FALSE" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <span className="text-muted-foreground">{t("yourAnswerLabel")}</span>{" "}
                        <span className="font-medium">
                          {answer?.booleanAnswer === true
                            ? t("true")
                            : answer?.booleanAnswer === false
                            ? t("false")
                            : t("noAnswer")}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
                        <span className="text-green-700 dark:text-green-300">{t("correctAnswerLabel")}</span>{" "}
                        <span className="font-medium text-green-700 dark:text-green-300">
                          {question.isCorrect ? t("true") : t("false")}
                        </span>
                      </div>
                    </div>
                  )}

                  {isShortAnswer && (
                    <div className="space-y-3 text-sm">
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <span className="text-muted-foreground">{t("yourAnswerLabel")}</span>{" "}
                        <span className="font-medium">
                          {answer?.textAnswer || t("noAnswer")}
                        </span>
                      </div>
                      {question.modelAnswer && (
                        <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
                          <span className="text-green-700 dark:text-green-300">
                            {t("modelAnswerLabel")}
                          </span>{" "}
                          <span className="font-medium text-green-700 dark:text-green-300">
                            {question.modelAnswer}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant={
                            answer?.isCorrect === true ? "default" : "outline"
                          }
                          size="sm"
                          disabled={gradingAnswerId === answer?.id}
                          aria-label={t("markCorrectAriaLabel")}
                          onClick={() =>
                            answer && void handleGrade(answer.id, true)
                          }
                        >
                          <CheckCircle2
                            className="h-3.5 w-3.5 mr-1"
                            aria-hidden="true"
                          />
                          {t("markCorrect")}
                        </Button>
                        <Button
                          type="button"
                          variant={
                            answer?.isCorrect === false
                              ? "destructive"
                              : "outline"
                          }
                          size="sm"
                          disabled={gradingAnswerId === answer?.id}
                          aria-label={t("markIncorrectAriaLabel")}
                          onClick={() =>
                            answer && void handleGrade(answer.id, false)
                          }
                        >
                          <XCircle
                            className="h-3.5 w-3.5 mr-1"
                            aria-hidden="true"
                          />
                          {t("markIncorrect")}
                        </Button>
                      </div>
                    </div>
                  )}

                  {question.explanation && (
                    <div className="flex gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                      <AlertCircle
                        className="h-4 w-4 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>{question.explanation}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          );
        })}
      </div>

      <LinkButton
        href={`/tests/${localAttempt.test.id}/attempt`}
        className="gap-2"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        {t("repeatTest")}
      </LinkButton>
    </div>
  );
}
