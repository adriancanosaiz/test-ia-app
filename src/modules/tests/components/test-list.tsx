"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SelectField, AccessibleSelectTrigger } from "@/components/ui/select-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { TestForm } from "./test-form";
import { deleteTest } from "../actions";
import {
  FlaskConical,
  Trash2,
  Eye,
  Trophy,
  Target,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowDown01,
  ArrowUp01,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TestListProps {
  tests: {
    id: string;
    title: string;
    difficulty: string;
    questionType: string;
    questionCount: number;
    sourceLabel: string;
    sourceName: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { attempts: number };
  }[];
}

type StatusFilter = "ALL" | "PROCESSING" | "READY" | "ERROR";
type SortOption =
  | "title-asc"
  | "title-desc"
  | "created-desc"
  | "created-asc"
  | "updated-desc"
  | "updated-asc";

const difficultyColors: Record<string, string> = {
  EASY: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  HARD: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const statusConfig: Record<
  string,
  {
    icon: typeof Loader2;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  PROCESSING: { icon: Loader2, variant: "default" },
  READY: { icon: CheckCircle2, variant: "default" },
  ERROR: { icon: AlertCircle, variant: "destructive" },
};

function getStatusLabel(status: string, t: (key: string) => string) {
  switch (status) {
    case "PROCESSING":
      return t("statusProcessing");
    case "READY":
      return t("statusReady");
    case "ERROR":
      return t("statusError");
    default:
      return status;
  }
}

function getStatusFilterLabel(status: StatusFilter, t: (key: string) => string) {
  if (status === "ALL") return t("statusAll");
  return getStatusLabel(status, t);
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

function TestStatusBadge({
  status,
  t,
}: {
  status: string;
  t: (key: string) => string;
}) {
  const config = statusConfig[status] ?? {
    icon: AlertCircle,
    variant: "secondary" as const,
  };
  const StatusIcon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "shrink-0 gap-1.5",
        status === "PROCESSING" && "animate-pulse"
      )}
    >
      <StatusIcon
        className={cn("h-3.5 w-3.5", status === "PROCESSING" && "animate-spin")}
        aria-hidden="true"
      />
      {getStatusLabel(status, t)}
    </Badge>
  );
}

export function TestList({ tests }: TestListProps) {
  const t = useTranslations("tests");
  const tc = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [testToDelete, setTestToDelete] = useState<
    TestListProps["tests"][number] | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("updated-desc");

  const filteredTests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = tests;

    if (query.length > 0) {
      result = result.filter(
        (test) =>
          test.title.toLowerCase().includes(query) ||
          test.sourceName.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "ALL") {
      result = result.filter((test) => test.status === statusFilter);
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        case "created-asc":
          return a.createdAt.getTime() - b.createdAt.getTime();
        case "created-desc":
          return b.createdAt.getTime() - a.createdAt.getTime();
        case "updated-asc":
          return a.updatedAt.getTime() - b.updatedAt.getTime();
        case "updated-desc":
        default:
          return b.updatedAt.getTime() - a.updatedAt.getTime();
      }
    });

    return result;
  }, [tests, searchQuery, statusFilter, sortBy]);

  function handleDeleteRequest(test: TestListProps["tests"][number]) {
    setTestToDelete(test);
    setIsDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!testToDelete) return;

    setIsDeleting(true);
    const result = await deleteTest(testToDelete.id);
    setIsDeleting(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("toastDeleteError"),
        description: getErrorMessage(result.error),
      });
      return;
    }

    setIsDeleteDialogOpen(false);
    router.refresh();
  }

  if (tests.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title={t("testListEmptyTitle")}
        description={t("testListEmptyDescription")}
      >
        <TestForm>
          <Button className="gap-2">
            <FlaskConical className="h-4 w-4" aria-hidden="true" />
            {t("newTest")}
          </Button>
        </TestForm>
      </EmptyState>
    );
  }

  const isSearchEmpty =
    filteredTests.length === 0 &&
    (searchQuery.trim().length > 0 || statusFilter !== "ALL");

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchTests")}
            className="pl-9"
            aria-label={t("searchTestsAriaLabel")}
          />
        </div>
        <SelectField label={t("status")} className="lg:w-48">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <AccessibleSelectTrigger>
              <SelectValue placeholder={t("filterByStatus")} />
            </AccessibleSelectTrigger>
            <SelectContent>
              {(["ALL", ...Object.keys(statusConfig)] as StatusFilter[]).map(
                (status) => (
                  <SelectItem key={status} value={status}>
                    {getStatusFilterLabel(status, t)}
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
              <SelectItem value="title-asc">
                <span className="flex items-center gap-2">
                  <ArrowDownAZ
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  {t("sortTitleAsc")}
                </span>
              </SelectItem>
              <SelectItem value="title-desc">
                <span className="flex items-center gap-2">
                  <ArrowUpAZ className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("sortTitleDesc")}
                </span>
              </SelectItem>
              <SelectItem value="created-desc">
                <span className="flex items-center gap-2">
                  <ArrowDown01
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  {t("sortCreatedDesc")}
                </span>
              </SelectItem>
              <SelectItem value="created-asc">
                <span className="flex items-center gap-2">
                  <ArrowUp01 className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("sortCreatedAsc")}
                </span>
              </SelectItem>
              <SelectItem value="updated-desc">
                <span className="flex items-center gap-2">
                  <ArrowDown01
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  {t("sortUpdatedDesc")}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </SelectField>
      </div>

      {isSearchEmpty ? (
        <EmptyState
          icon={Search}
          title={t("testsNotFound")}
          description={t("testsNotFoundDescription")}
        />
      ) : (
        <ul
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          aria-label={t("testsListAriaLabel")}
        >
          {filteredTests.map((test) => (
            <li key={test.id}>
              <Card className="group overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 h-full animate-fade-in">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FlaskConical className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <TestStatusBadge status={test.status} t={t} />
                      <Badge
                        variant="outline"
                        className={cn(difficultyColors[test.difficulty])}
                      >
                        {getDifficultyLabel(test.difficulty, t)}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle as="h2" className="text-lg mt-3">
                    <Link
                      href={`/tests/${test.id}`}
                      className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    >
                      {test.title}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {t("sourceLabel", {
                      label: test.sourceLabel,
                      name: test.sourceName,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" aria-hidden="true" />
                      <span>{t("questionsCount", { count: test.questionCount })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" aria-hidden="true" />
                      <span>{getQuestionTypeLabel(test.questionType, t)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {test._count.attempts === 1
                          ? t("attemptsCount", { count: test._count.attempts })
                          : t("attemptsCountPlural", { count: test._count.attempts })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/tests/${test.id}`} className="flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1"
                        aria-label={t("viewTestAriaLabel", { title: test.title })}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("view")}
                      </Button>
                    </Link>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1"
                      aria-label={t("deleteTestAriaLabel", { title: test.title })}
                      onClick={() => handleDeleteRequest(test)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={t("deleteTestTitle")}
        description={
          testToDelete
            ? t("deleteTestDescription", { title: testToDelete.title })
            : t("deleteTestDescriptionFallback")
        }
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        variant="destructive"
        isPending={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
