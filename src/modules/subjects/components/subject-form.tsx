"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { FormError } from "@/components/ui/form-error";
import { useToast } from "@/hooks/use-toast";
import { useFormAction } from "@/lib/form/use-form-action";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createSubject, updateSubject } from "../actions";

interface SubjectFormProps {
  folderId: string;
  subject?: { id: string; name: string; description: string | null };
  children?: React.ReactNode;
}

export function SubjectForm({ folderId, subject, children }: SubjectFormProps) {
  const t = useTranslations("subjects");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(subject?.name ?? "");
  const [description, setDescription] = useState(subject?.description ?? "");

  const { isLoading, globalError, fieldErrors, handleSubmit, resetErrors } =
    useFormAction({
      action: (formData: FormData) => {
        return subject
          ? updateSubject(subject.id, formData)
          : createSubject(folderId, formData);
      },
      onSuccess: () => {
        setOpen(false);
        router.refresh();
      },
    });

  function resetForm() {
    setName(subject?.name ?? "");
    setDescription(subject?.description ?? "");
    resetErrors();
  }

  async function onSubmit(formData: FormData) {
    const result = await handleSubmit(formData);

    if (result && !result.success) {
      if (result.error.type === "SYSTEM_ERROR") {
        toast({
          variant: "destructive",
          title: tCommon("error"),
          description: getErrorMessage(result.error),
        });
      }
    }
  }

  const nameError = fieldErrors.name;
  const hasNameError = !!nameError;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {children ?? (
          <Button>
            {subject ? t("formTriggerEdit") : t("formTriggerCreate")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {subject ? t("formEditTitle") : t("formCreateTitle")}
          </DialogTitle>
          <DialogDescription>
            {subject ? t("formEditDescription") : t("formCreateDescription")}
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          {globalError && <FormError>{globalError}</FormError>}
          <FormField
            id="subject-name"
            label={t("formNameLabel")}
            required
            error={nameError}
          >
            <Input
              id="subject-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-invalid={hasNameError}
              aria-describedby={hasNameError ? "subject-name-error" : undefined}
              disabled={isLoading}
            />
          </FormField>
          <FormField id="subject-description" label={t("formDescriptionLabel")}>
            <Input
              id="subject-description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
            />
          </FormField>
          <Button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading
              ? tCommon("saving")
              : subject
              ? t("formSubmitEdit")
              : t("formSubmitCreate")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
