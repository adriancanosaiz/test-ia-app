"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
import { AppSettings, Language } from "@/lib/settings/types";
import { saveSettings } from "@/lib/settings/actions";
import { LOCALE_COOKIE } from "@/lib/i18n/constants";

interface LanguageSelectorProps {
  settings: AppSettings;
}

export function LanguageSelector({ settings }: LanguageSelectorProps) {
  const t = useTranslations("settings");
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [language, setLanguage] = useState<Language>(settings.language);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving || language === settings.language) return;

    setSaving(true);
    const result = await saveSettings({
      ...settings,
      language,
    });
    setSaving(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("saveError"),
        description: getErrorMessage(result.error),
      });
      return;
    }

    document.cookie = `${LOCALE_COOKIE}=${language}; path=/; max-age=31536000`;

    toast({
      variant: "success",
      title: t("saved"),
      description:
        language === Language.ES
          ? t("languageChangedEs")
          : t("languageChangedEn"),
    });

    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <SelectField label={t("languageLabel")}>
        <Select
          value={language}
          onValueChange={(value) => setLanguage(value as Language)}
        >
          <AccessibleSelectTrigger className="w-full sm:w-[240px]">
            <SelectValue />
          </AccessibleSelectTrigger>
          <SelectContent>
            <SelectItem value={Language.ES}>{t("spanish")}</SelectItem>
            <SelectItem value={Language.EN}>{t("english")}</SelectItem>
          </SelectContent>
        </Select>
      </SelectField>

      <Button
        onClick={handleSave}
        disabled={saving || language === settings.language}
        aria-busy={saving}
      >
        {saving && <Spinner size="sm" />}
        {t("saveLanguage")}
      </Button>
    </div>
  );
}
