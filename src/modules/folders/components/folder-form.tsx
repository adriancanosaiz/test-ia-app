"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { FormError } from "@/components/ui/form-error";
import { ColorPicker } from "@/components/ui/color-picker";
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
import { createFolder, updateFolder } from "../actions";

interface FolderFormProps {
  folder?: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
  };
  children?: React.ReactNode;
}

export function FolderForm({ folder, children }: FolderFormProps) {
  const t = useTranslations("folders");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(folder?.name ?? "");
  const [description, setDescription] = useState(folder?.description ?? "");
  const [color, setColor] = useState(folder?.color ?? "");

  const { isLoading, globalError, fieldErrors, handleSubmit, resetErrors } =
    useFormAction({
      action: (formData: FormData) => {
        return folder
          ? updateFolder(folder.id, formData)
          : createFolder(formData);
      },
      onSuccess: () => {
        setOpen(false);
        router.refresh();
      },
    });

  function resetForm() {
    setName(folder?.name ?? "");
    setDescription(folder?.description ?? "");
    setColor(folder?.color ?? "");
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
  const colorError = fieldErrors.color;

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
          <Button>{folder ? tCommon("edit") : t("formTriggerCreate")}</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {folder ? t("formEditTitle") : t("formCreateTitle")}
          </DialogTitle>
          <DialogDescription>
            {folder ? t("formEditDescription") : t("formCreateDescription")}
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          {globalError && <FormError>{globalError}</FormError>}
          <FormField id="folder-name" label={t("formNameLabel")} required error={nameError}>
            <Input
              id="folder-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-invalid={hasNameError}
              aria-describedby={
                hasNameError ? "folder-name-error" : undefined
              }
              disabled={isLoading}
            />
          </FormField>
          <FormField id="folder-description" label={t("formDescriptionLabel")}>
            <Input
              id="folder-description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
            />
          </FormField>
          <input type="hidden" name="color" value={color} />
          <ColorPicker
            label={t("formColorLabel")}
            value={color}
            onChange={setColor}
            error={colorError}
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading
              ? tCommon("saving")
              : folder
              ? t("formSubmitEdit")
              : t("formSubmitCreate")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
