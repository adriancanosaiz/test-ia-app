"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
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
import { createChatSession } from "../actions";
import { FileText } from "lucide-react";

interface NewChatDialogProps {
  documents: {
    id: string;
    title: string;
    subject: {
      name: string;
      folder: { name: string };
    };
  }[];
  children?: React.ReactNode;
}

export function NewChatDialog({ documents, children }: NewChatDialogProps) {
  const t = useTranslations("chat");
  const tc = useTranslations("common");
  const router = useRouter();
  const getErrorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [documentId, setDocumentId] = useState<string>("global");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const documentItems = useMemo(
    () => [
      { value: "global", label: t("globalScope") },
      ...documents.map((doc) => ({
        value: doc.id,
        label: `${doc.title} (${doc.subject.folder.name} / ${doc.subject.name})`,
      })),
    ],
    [documents, t]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const result = await createChatSession({
      title: title.trim() || t("fallbackTitle"),
      sourceDocumentId: documentId === "global" ? undefined : documentId,
    });
    setIsLoading(false);

    if (!result.success) {
      setError(getErrorMessage(result.error));
      return;
    }

    setOpen(false);
    router.push(`/chat/${result.data.id}`);
    router.refresh();
  }

  const hasError = !!error;
  const hasDocuments = documents.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? <Button>{t("newChat")}</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        {hasDocuments ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField id="chat-title" label={t("titleLabel")} error={error}>
              <Input
                id="chat-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("titlePlaceholder")}
                aria-invalid={hasError}
                aria-describedby={hasError ? "chat-title-error" : undefined}
                disabled={isLoading}
              />
            </FormField>
            <SelectField label={t("scopeLabel")}>
              <Select
                value={documentId}
                onValueChange={(value) => setDocumentId(value ?? "global")}
                items={documentItems}
              >
                <AccessibleSelectTrigger className="w-full">
                  <SelectValue placeholder={t("scopePlaceholder")} />
                </AccessibleSelectTrigger>
                <SelectContent>
                  {documentItems.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SelectField>
            <Button type="submit" disabled={isLoading} aria-busy={isLoading}>
              {isLoading ? tc("creating") : tc("create")}
            </Button>
          </form>
        ) : (
          <EmptyState
            icon={FileText}
            title={t("noDocumentsTitle")}
            description={t("noDocumentsDescription")}
          >
            <LinkButton href="/dashboard" size="sm">
              {t("goToDashboard")}
            </LinkButton>
          </EmptyState>
        )}
      </DialogContent>
    </Dialog>
  );
}
