"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
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
import { ChatProvider, Language } from "@/lib/settings/types";
import { validateExternalProvider } from "@/lib/settings/validate-provider";
import { saveSettings } from "@/lib/settings/actions";
import {
  getExternalModels,
  getExternalProviderDefaultBaseUrl,
} from "@/modules/ai/external-models";

const EMBEDDING_MODEL = "nomic-embed-text";

export type ExternalProvider = Exclude<ChatProvider, "ollama">;

interface ExternalApiFormProps {
  onSaved?: () => void;
}

const PROVIDER_OPTIONS: { value: ExternalProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "groq", label: "Groq" },
];

export function ExternalApiForm({ onSaved }: ExternalApiFormProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const [provider, setProvider] = useState<ExternalProvider>("openai");
  const [model, setModel] = useState<string>(
    getExternalModels("openai")[0]?.value ?? ""
  );
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);

  const models = useMemo(() => getExternalModels(provider), [provider]);

  function handleProviderChange(value: ExternalProvider) {
    setProvider(value);
    setModel(getExternalModels(value)[0]?.value ?? "");
  }

  async function handleValidate() {
    if (validating) return;

    setValidating(true);
    const result = await validateExternalProvider({
      provider,
      apiKey,
      baseUrl: baseUrl || undefined,
      chatModel: model,
    });
    setValidating(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("connectionError"),
        description: getErrorMessage(result.error),
      });
      return;
    }

    toast({
      variant: "success",
      title: t("connectionSuccess"),
      description: t("apiResponds", { provider }),
    });
  }

  async function handleSave() {
    if (saving) return;

    setSaving(true);
    const result = await saveSettings({
      chatProvider: provider,
      chatModel: model,
      embeddingProvider: "ollama",
      embeddingModel: EMBEDDING_MODEL,
      apiKey,
      baseUrl: baseUrl || undefined,
      language: locale as Language,
    });
    setSaving(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: tc("error"),
        description: getErrorMessage(result.error),
      });
      return;
    }

    toast({
      variant: "success",
      title: t("saveSuccess"),
      description: t("externalSaveDescription", { model }),
    });

    onSaved?.();
  }

  return (
    <div className="space-y-4">
      <SelectField label={t("providerLabel")}>
        <Select
          value={provider}
          onValueChange={(value) =>
            handleProviderChange((value ?? "openai") as ExternalProvider)
          }
        >
          <AccessibleSelectTrigger>
            <SelectValue />
          </AccessibleSelectTrigger>
          <SelectContent>
            {PROVIDER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SelectField>

      <SelectField label={t("modelLabel")}>
        <Select
          value={model}
          onValueChange={(value) => setModel(value ?? "")}
        >
          <AccessibleSelectTrigger>
            <SelectValue />
          </AccessibleSelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SelectField>

      <FormField id="external-api-key" label={t("apiKeyLabel")} required>
        <Input
          id="external-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t("baseUrlPlaceholder")}
          aria-required="true"
        />
      </FormField>

      <FormField id="external-base-url" label={t("baseUrlLabel")}>
        <Input
          id="external-base-url"
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={getExternalProviderDefaultBaseUrl(provider)}
        />
      </FormField>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={handleValidate}
          disabled={validating || !apiKey}
          aria-busy={validating}
        >
          {validating && <Spinner size="sm" />}
          {t("testConnection")}
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !apiKey || !model}
          aria-busy={saving}
        >
          {saving && <Spinner size="sm" />}
          {t("saveConfiguration")}
        </Button>
      </div>

    </div>
  );
}
