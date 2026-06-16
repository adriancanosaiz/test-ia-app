"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import {
  SelectField,
  AccessibleSelectTrigger,
} from "@/components/ui/select-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Eye,
  Trophy,
  HelpCircle,
  Play,
  Search,
  ArrowDown01,
  ArrowUp01,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AttemptListProps {
  testId: string;
  attempts: {
    id: string;
    score: number | null;
    startedAt: Date;
    finishedAt: Date | null;
  }[];
}

type ResultFilter = "ALL" | "PASS" | "FAIL" | "UNGRADED";
type SortOption = "started-desc" | "started-asc" | "score-desc" | "score-asc";

const PASS_THRESHOLD = 80;

function scoreBadge(score: number | null, t: (key: string, values?: Record<string, string | number | Date>) => string) {
  if (score === null) {
    return {
      label: t("ungraded"),
      icon: HelpCircle,
      className: "bg-muted text-muted-foreground",
    };
  }
  if (score >= 80) {
    return {
      label: t("scorePercent", { score }),
      icon: Trophy,
      className:
        "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    };
  }
  if (score >= 50) {
    return {
      label: t("scorePercent", { score }),
      icon: Trophy,
      className:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    };
  }
  return {
    label: t("scorePercent", { score }),
    icon: Trophy,
    className:
      "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };
}

function getResultFilterLabel(filter: ResultFilter, t: (key: string, values?: Record<string, string | number | Date>) => string) {
  switch (filter) {
    case "ALL":
      return t("resultAll");
    case "PASS":
      return t("resultPass");
    case "FAIL":
      return t("resultFail");
    case "UNGRADED":
      return t("resultUngraded");
    default:
      return filter;
  }
}

function getSortLabel(sort: SortOption, t: (key: string, values?: Record<string, string | number | Date>) => string) {
  switch (sort) {
    case "started-desc":
      return t("sortStartedDesc");
    case "started-asc":
      return t("sortStartedAsc");
    case "score-desc":
      return t("sortScoreDesc");
    case "score-asc":
      return t("sortScoreAsc");
    default:
      return sort;
  }
}

export function AttemptList({ testId, attempts }: AttemptListProps) {
  const t = useTranslations("tests");
  const locale = useLocale();
  const [searchQuery, setSearchQuery] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("started-desc");

  const filteredAttempts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = attempts;

    if (query.length > 0) {
      const dateString = query;
      result = result.filter((attempt) => {
        const attemptNumber = String(
          attempts.length - attempts.indexOf(attempt)
        );
        const attemptDate = new Intl.DateTimeFormat(locale, {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(attempt.startedAt));
        return (
          attemptNumber.includes(query) ||
          attemptDate.toLowerCase().includes(dateString)
        );
      });
    }

    if (resultFilter !== "ALL") {
      result = result.filter((attempt) => {
        if (resultFilter === "UNGRADED") return attempt.score === null;
        if (resultFilter === "PASS")
          return attempt.score !== null && attempt.score >= PASS_THRESHOLD;
        return attempt.score !== null && attempt.score < PASS_THRESHOLD;
      });
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "started-asc":
          return a.startedAt.getTime() - b.startedAt.getTime();
        case "started-desc":
        default:
          return b.startedAt.getTime() - a.startedAt.getTime();
        case "score-asc":
          return (a.score ?? -1) - (b.score ?? -1);
        case "score-desc":
          return (b.score ?? -1) - (a.score ?? -1);
      }
    });

    return result;
  }, [attempts, searchQuery, resultFilter, sortBy, locale]);

  if (attempts.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title={t("attemptsEmptyTitle")}
        description={t("attemptsEmptyDescription")}
      >
        <LinkButton href={`/tests/${testId}/attempt`} className="gap-2">
          <Play className="h-4 w-4" aria-hidden="true" />
          {t("takeTest")}
        </LinkButton>
      </EmptyState>
    );
  }

  const isSearchEmpty =
    filteredAttempts.length === 0 &&
    (searchQuery.trim().length > 0 || resultFilter !== "ALL");

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchAttempts")}
            className="pl-9"
            aria-label={t("searchAttemptsAriaLabel")}
          />
        </div>
        <SelectField label={t("result")} className="lg:w-48">
          <Select
            value={resultFilter}
            onValueChange={(value) => setResultFilter(value as ResultFilter)}
          >
            <AccessibleSelectTrigger>
              <SelectValue placeholder={t("filterByResult")} />
            </AccessibleSelectTrigger>
            <SelectContent>
              {(["ALL", "PASS", "FAIL", "UNGRADED"] as ResultFilter[]).map(
                (filter) => (
                  <SelectItem key={filter} value={filter}>
                    {getResultFilterLabel(filter, t)}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </SelectField>
        <SelectField label={t("sortBy")} className="lg:w-56">
          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as SortOption)}
          >
            <AccessibleSelectTrigger>
              <SelectValue placeholder={t("sortBy")} />
            </AccessibleSelectTrigger>
            <SelectContent>
              {(
                [
                  "started-desc",
                  "started-asc",
                  "score-desc",
                  "score-asc",
                ] as SortOption[]
              ).map((sort) => (
                <SelectItem key={sort} value={sort}>
                  <span className="flex items-center gap-2">
                    {sort.startsWith("started") ? (
                      sort === "started-desc" ? (
                        <ArrowDown01
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      ) : (
                        <ArrowUp01
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      )
                    ) : (
                      <Percent
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                    )}
                    {getSortLabel(sort, t)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SelectField>
      </div>

      {isSearchEmpty ? (
        <EmptyState
          icon={Search}
          title={t("attemptsNotFound")}
          description={t("attemptsNotFoundDescription")}
        />
      ) : (
        <ul className="space-y-3" aria-label={t("attemptsListAriaLabel")}>
          {filteredAttempts.map((attempt, index) => {
            const badge = scoreBadge(attempt.score, t);
            const attemptNumber = filteredAttempts.length - index;
            const BadgeIcon = badge.icon;
            return (
              <li key={attempt.id}>
                <Card className="overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-in">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <span className="font-bold text-sm">
                            #{attemptNumber}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold">
                            {t("attemptTitle", { number: attemptNumber })}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            {new Intl.DateTimeFormat(locale, {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(attempt.startedAt))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          className={cn(
                            "px-3 py-1 text-sm gap-1.5",
                            badge.className
                          )}
                        >
                          <BadgeIcon
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          {badge.label}
                        </Badge>
                        <Link href={`/tests/${testId}/attempts/${attempt.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            aria-label={t("viewAttemptAriaLabel", {
                              number: attemptNumber,
                            })}
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            {t("view")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
