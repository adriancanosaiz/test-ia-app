"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { createTest, getScopeOptions } from "../actions";
import type { FieldErrors } from "@/lib/errors";
import type { SourceType } from "@prisma/client";

interface TestFormProps {
  children?: React.ReactNode;
}

function getSourceTypeLabel(type: SourceType, t: (key: string) => string) {
  switch (type) {
    case "FOLDER":
      return t("sourceFolder");
    case "SUBJECT":
      return t("sourceSubject");
    case "DOCUMENT":
      return t("sourceDocument");
    default:
      return type;
  }
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

export function TestForm({ children }: TestFormProps) {
  const t = useTranslations("tests");
  const router = useRouter();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>("DOCUMENT");
  const [sourceId, setSourceId] = useState("");
  const [sourceOptions, setSourceOptions] = useState<
    { id: string; name: string; title?: string }[]
  >([]);
  const [sourceOptionsLoading, setSourceOptionsLoading] = useState(false);
  const [questionType, setQuestionType] = useState("MULTIPLE_CHOICE");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [questionCount, setQuestionCount] = useState(5);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const sourceTypeItems = useMemo(
    () =>
      (["FOLDER", "SUBJECT", "DOCUMENT"] as SourceType[]).map((value) => ({
        value,
        label: getSourceTypeLabel(value, t),
      })),
    [t]
  );

  const questionTypeItems = useMemo(
    () =>
      (["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"] as const).map(
        (value) => ({
          value,
          label: getQuestionTypeLabel(value, t),
        })
      ),
    [t]
  );

  const difficultyItems = useMemo(
    () =>
      (["EASY", "MEDIUM", "HARD"] as const).map((value) => ({
        value,
        label: getDifficultyLabel(value, t),
      })),
    [t]
  );

  const sourceItems = useMemo(
    () =>
      sourceOptions.map((option) => ({
        value: option.id,
        label: option.name ?? option.title ?? option.id,
      })),
    [sourceOptions]
  );

  useEffect(() => {
    async function loadOptions() {
      setSourceId("");
      setSourceOptionsLoading(true);
      try {
        const options = await getScopeOptions(sourceType);
        setSourceOptions(options as { id: string; name: string; title?: string }[]);
      } catch {
        toast({
          variant: "destructive",
          title: t("scopeOptionsError"),
          description: t("scopeOptionsErrorDescription"),
        });
        setSourceOptions([]);
      } finally {
        setSourceOptionsLoading(false);
      }
    }
    if (open) {
      loadOptions();
    }
  }, [sourceType, open, toast, t]);

  async function handleSubmit(formData: FormData) {
    setFieldErrors({});
    setServerError(null);
    setIsLoading(true);
    const data = {
      title: (formData.get("title") as string) || undefined,
      sourceType: sourceType as SourceType,
      sourceId,
      questionType: questionType as
        | "MULTIPLE_CHOICE"
        | "TRUE_FALSE"
        | "SHORT_ANSWER",
      difficulty: difficulty as "EASY" | "MEDIUM" | "HARD",
      questionCount: Number(formData.get("questionCount")),
    };

    const result = await createTest(data);
    setIsLoading(false);

    if (!result.success) {
      setFieldErrors(result.fieldErrors ?? {});
      const hasFieldErrors = Object.keys(result.fieldErrors ?? {}).length > 0;
      if (result.error.type === "SYSTEM_ERROR") {
        toast({
          variant: "destructive",
          title: t("createTestError"),
          description: getErrorMessage(result.error),
        });
        setServerError(getErrorMessage(result.error));
      } else if (!hasFieldErrors) {
        setServerError(getErrorMessage(result.error));
      }
      return;
    }

    setOpen(false);
    router.push(`/tests/${result.data.id}`);
    router.refresh();
  }

  const questionCountError = fieldErrors.questionCount?.[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? <Button>{t("newTest")}</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("createTestTitle")}</DialogTitle>
          <DialogDescription>
            {t("createTestDescription")}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-5">
          <FormField
            id="test-title"
            label={t("titleOptional")}
            error={fieldErrors.title?.[0]}
          >
            <Input
              id="test-title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
              disabled={isLoading}
              aria-invalid={!!fieldErrors.title}
              aria-describedby={
                fieldErrors.title ? "test-title-error" : undefined
              }
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <SelectField label={t("scope")} error={fieldErrors.sourceType?.[0]}>
              <Select
                value={sourceType}
                onValueChange={(value) => setSourceType(value as SourceType)}
                items={sourceTypeItems}
              >
                <AccessibleSelectTrigger className="w-full">
                  <SelectValue placeholder={t("select")} />
                </AccessibleSelectTrigger>
                <SelectContent>
                  {sourceTypeItems.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SelectField>

            <SelectField label={t("element")} error={fieldErrors.sourceId?.[0]}>
              <Select
                value={sourceId}
                onValueChange={(value) => setSourceId(value ?? "")}
                items={sourceItems}
                disabled={sourceOptionsLoading || sourceItems.length === 0}
              >
                <AccessibleSelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      sourceOptionsLoading
                        ? t("loading")
                        : sourceItems.length === 0
                        ? t("noOptions")
                        : t("select")
                    }
                  />
                </AccessibleSelectTrigger>
                <SelectContent>
                  {sourceItems.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SelectField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label={t("questionType")}
              error={fieldErrors.questionType?.[0]}
            >
              <Select
                value={questionType}
                onValueChange={(value) =>
                  setQuestionType(value ?? "MULTIPLE_CHOICE")
                }
                items={questionTypeItems}
              >
                <AccessibleSelectTrigger className="w-full">
                  <SelectValue placeholder={t("select")} />
                </AccessibleSelectTrigger>
                <SelectContent>
                  {questionTypeItems.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SelectField>

            <SelectField label={t("difficulty")} error={fieldErrors.difficulty?.[0]}>
              <Select
                value={difficulty}
                onValueChange={(value) => setDifficulty(value ?? "MEDIUM")}
                items={difficultyItems}
              >
                <AccessibleSelectTrigger className="w-full">
                  <SelectValue placeholder={t("select")} />
                </AccessibleSelectTrigger>
                <SelectContent>
                  {difficultyItems.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SelectField>
          </div>

          <FormField
            id="questionCount"
            label={t("questionCount")}
            required
            error={questionCountError}
          >
            <Input
              id="questionCount"
              name="questionCount"
              type="number"
              min={1}
              max={20}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              required
              aria-invalid={!!questionCountError}
              aria-describedby={
                questionCountError ? "questionCount-error" : undefined
              }
              disabled={isLoading}
            />
          </FormField>

          {serverError && (
            <p
              role="alert"
              className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg"
            >
              {serverError}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading || !sourceId}
            aria-busy={isLoading}
          >
            {isLoading ? t("creatingTest") : t("createTestSubmit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
