"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Spinner } from "@/components/ui/spinner";
import { uploadDocument } from "../actions";
import { Upload, FileUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSupportedMimeType, MAX_FILE_SIZE } from "../constants";

interface DocumentUploadProps {
  subjectId: string;
}

export function DocumentUpload({ subjectId }: DocumentUploadProps) {
  const t = useTranslations("documents");
  const router = useRouter();
  const getErrorMessage = useErrorMessage();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function validateFile(file: File): string | null {
    if (!isSupportedMimeType(file.type)) {
      return t("uploadErrorUnsupported");
    }
    if (file.size === 0) {
      return t("uploadErrorEmpty");
    }
    if (file.size > MAX_FILE_SIZE) {
      return t("uploadErrorMaxSize");
    }
    return null;
  }

  function handleSubmit(formData: FormData) {
    const file =
      fileInputRef.current?.files?.[0] ?? (formData.get("file") as File | null);
    const validationError = file ? validateFile(file) : t("uploadErrorNoFile");

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!file) {
      setError(t("uploadErrorNoFile"));
      return;
    }

    setError(null);
    if (!file) return;

    const fd = new FormData();
    fd.append("subjectId", subjectId);
    fd.append("file", file);

    startTransition(async () => {
      const result = await uploadDocument(fd);

      if (!result.success) {
        const fieldError = Object.values(result.fieldErrors ?? {})[0]?.[0];
        setError(fieldError ?? getErrorMessage(result.error));
        return;
      }

      formRef.current?.reset();
      setFileName(null);
      router.refresh();
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setError(validateFile(file));
      setFileName(file.name);
    } else {
      setError(null);
      setFileName(null);
    }
  }

  function handleFileDrop(file: File | undefined) {
    if (!file) {
      setError(null);
      setFileName(null);
      return;
    }
    setError(validateFile(file));
    setFileName(file.name);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
      handleFileDrop(file);
    }
  }

  function clearFile(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFileName(null);
    setError(null);
  }

  const hasError = !!error;

  return (
    <form
      ref={formRef}
      onSubmit={async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        await handleSubmit(formData);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="subjectId" value={subjectId} />
      <FormField id="file" label={t("uploadLabel")} required error={error}>
        <label
          htmlFor="file"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30 hover:bg-muted/50"
          )}
        >
          <Input
            id="file"
            name="file"
            type="file"
            ref={fileInputRef}
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            required
            className="sr-only"
            onChange={handleFileChange}
            aria-invalid={hasError}
            aria-describedby={hasError ? "file-error" : undefined}
            disabled={isPending}
          />
          {fileName ? (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileUp className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-foreground">{fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {t("uploadReplaceHint")}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("uploadRemoveAriaLabel")}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  clearFile();
                }}
                className="absolute top-3 right-3 h-8 w-8"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Upload className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {t("uploadDragOrClick")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("uploadHint")}
                </p>
              </div>
            </>
          )}
        </label>
      </FormField>
      <Button
        type="submit"
        disabled={isPending || !fileName || !!error}
        aria-busy={isPending}
        className="gap-2"
      >
        {isPending ? (
          <>
            <Spinner size="sm" aria-hidden="true" />
            {t("uploadSubmitting")}
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" aria-hidden="true" />
            {t("uploadSubmit")}
          </>
        )}
      </Button>
    </form>
  );
}
