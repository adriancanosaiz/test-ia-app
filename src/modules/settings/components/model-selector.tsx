"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useToast } from "@/hooks/use-toast";
import { useModelPull } from "../hooks/use-model-pull";
import { saveSettings } from "@/lib/settings/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectValue,
} from "@/components/ui/select";
import {
  SelectField,
  AccessibleSelectTrigger,
} from "@/components/ui/select-field";
import { FormError } from "@/components/ui/form-error";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Language } from "@/lib/settings/types";
import { isModelInstalled, type RecommendedModel } from "@/modules/ai/ollama-models";
import type { OllamaModelsResponse } from "@/app/api/ollama/models/route";
import { ExternalApiForm } from "./external-api-form";

interface ModelSelectorProps {
  onSaved?: () => void;
  showApiTab?: boolean;
}

interface SelectGroupItem {
  group: string;
  items: { value: string; label: string }[];
}

const EMBEDDING_MODEL = "nomic-embed-text";

export function ModelSelector({ onSaved, showApiTab = true }: ModelSelectorProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const getErrorMessage = useErrorMessage();
  const {
    pullingModel,
    pullProgress,
    pullStatus,
    error: pullError,
    pullModel,
    resetError: resetPullError,
  } = useModelPull();

  const [installed, setInstalled] = useState<string[]>([]);
  const [recommended, setRecommended] = useState<RecommendedModel[]>([]);
  const [recommendedByHardware, setRecommendedByHardware] =
    useState<RecommendedModel | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [savingModel, setSavingModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadModels() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/ollama/models");
      if (!response.ok) {
        throw new Error(t("loadModelsError"));
      }

      const data = (await response.json()) as OllamaModelsResponse;
      setInstalled(data.installed);
      setRecommended(data.recommended);
      setRecommendedByHardware(data.recommendedByHardware);

      if (!selectedModel) {
        if (data.recommendedByHardware) {
          setSelectedModel(data.recommendedByHardware.name);
        } else if (data.recommended.length > 0) {
          setSelectedModel(data.recommended[0].name);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("unknownError");
      setError(message);
      toast({
        variant: "destructive",
        title: tc("error"),
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const response = await fetch("/api/ollama/models");
        if (cancelled) return;

        if (!response.ok) {
          throw new Error(t("loadModelsError"));
        }

        const data = (await response.json()) as OllamaModelsResponse;
        if (cancelled) return;

        setInstalled(data.installed);
        setRecommended(data.recommended);
        setRecommendedByHardware(data.recommendedByHardware);

        if (data.recommendedByHardware) {
          setSelectedModel(data.recommendedByHardware.name);
        } else if (data.recommended.length > 0) {
          setSelectedModel(data.recommended[0].name);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Error desconocido";
        setError(message);
        toast({
          variant: "destructive",
          title: "Error",
          description: message,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [toast, t]);

  const selectItems = useMemo<SelectGroupItem[]>(() => {
    const installedItems = installed.map((name) => ({
      value: name,
      label: `${name} ${t("installedSuffix")}`,
    }));

    const recommendedItems = recommended
      .filter((model) => !isModelInstalled(model.name, installed))
      .map((model) => ({
        value: model.name,
        label: model.label,
      }));

    return [
      { group: t("installedGroup"), items: installedItems },
      { group: t("recommendedGroup"), items: recommendedItems },
    ].filter((group) => group.items.length > 0);
  }, [installed, recommended, t]);

  async function handleSaveSettings(model: string) {
    const result = await saveSettings({
      chatProvider: "ollama",
      chatModel: model,
      embeddingProvider: "ollama",
      embeddingModel: EMBEDDING_MODEL,
      language: locale as Language,
    });

    if (!result.success) {
      throw new Error(getErrorMessage(result.error));
    }
  }

  async function handleUse(model: string) {
    if (savingModel || pullingModel) return;

    setSavingModel(model);
    setError(null);

    try {
      await handleSaveSettings(model);
      toast({
        variant: "success",
        title: t("saveSuccess"),
        description: t("useModelDescription", { model }),
      });
      onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("unknownError");
      setError(message);
      toast({
        variant: "destructive",
        title: tc("error"),
        description: message,
      });
    } finally {
      setSavingModel(null);
    }
  }

  async function handlePull(model: string) {
    if (savingModel || pullingModel) return;

    resetPullError();
    setError(null);

    const result = await pullModel(model);

    if (!result.success) {
      const message = result.error ?? t("downloadError");
      setError(message);
      toast({
        variant: "destructive",
        title: tc("error"),
        description: message,
      });
      return;
    }

    await loadModels();

    setSavingModel(model);
    try {
      await handleSaveSettings(model);
      toast({
        variant: "success",
        title: t("modelReady"),
        description: t("modelReadyDescription", { model }),
      });
      onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("unknownError");
      setError(message);
      toast({
        variant: "destructive",
        title: tc("error"),
        description: message,
      });
    } finally {
      setSavingModel(null);
    }
  }

  const displayedError = error ?? pullError;

  if (loading && recommended.length === 0) {
    return (
      <div className="flex justify-center p-8">
        <Spinner label={t("loadingModels")} />
      </div>
    );
  }

  const ollamaTab = (
    <div className="space-y-6">
      {displayedError && <FormError>{displayedError}</FormError>}

      {recommendedByHardware && (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t("recommendedForYou")}</CardTitle>
            <CardDescription>
              {t("recommendedDescription", {
                model: recommendedByHardware.label,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>{recommendedByHardware.description}</p>
            <div className="flex flex-wrap gap-2">
              {recommendedByHardware.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              {recommendedByHardware.sizeGB && (
                <p>{t("size", { size: recommendedByHardware.sizeGB })}</p>
              )}
              {recommendedByHardware.minRamGB && (
                <p>{t("minRam", { minRam: recommendedByHardware.minRamGB })}</p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            {isModelInstalled(recommendedByHardware.name, installed) ? (
              <Button
                onClick={() => handleUse(recommendedByHardware.name)}
                disabled={savingModel === recommendedByHardware.name}
                aria-busy={savingModel === recommendedByHardware.name}
              >
                {savingModel === recommendedByHardware.name && (
                  <Spinner size="sm" />
                )}
                {t("useThisModel")}
              </Button>
            ) : (
              <Button
                onClick={() => handlePull(recommendedByHardware.name)}
                disabled={pullingModel === recommendedByHardware.name}
                aria-busy={pullingModel === recommendedByHardware.name}
              >
                {pullingModel === recommendedByHardware.name && (
                  <Spinner size="sm" />
                )}
                {t("useAndDownload")}
              </Button>
            )}
          </CardFooter>
        </Card>
      )}

      <section aria-labelledby="model-list-heading">
        <h2
          id="model-list-heading"
          className="text-lg font-medium mb-4"
        >
          {t("availableModels")}
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommended.map((model) => {
            const installedFlag = isModelInstalled(model.name, installed);
            const isPullingThis = pullingModel === model.name;
            const isSavingThis = savingModel === model.name;

            return (
              <li key={model.name}>
                <Card>
                  <CardHeader>
                    <CardTitle as="h3">{model.label}</CardTitle>
                    <CardDescription>{model.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {model.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {model.sizeGB && <p>{t("size", { size: model.sizeGB })}</p>}
                      {model.minRamGB && (
                        <p>{t("minRam", { minRam: model.minRamGB })}</p>
                      )}
                    </div>
                    <Badge variant={installedFlag ? "success" : "secondary"}>
                      {installedFlag
                        ? t("installed")
                        : isPullingThis
                          ? t("downloading")
                          : t("notInstalled")}
                    </Badge>
                    {isPullingThis && (
                      <div
                        role="status"
                        aria-live="polite"
                        aria-label={t("downloadProgress")}
                      >
                        <Progress
                          value={pullProgress}
                          max={100}
                          label={pullStatus || t("downloading")}
                        />
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    {installedFlag ? (
                      <Button
                        onClick={() => handleUse(model.name)}
                        disabled={isSavingThis || !!pullingModel}
                        aria-busy={isSavingThis}
                      >
                        {isSavingThis && <Spinner size="sm" />}
                        {t("useThisModel")}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handlePull(model.name)}
                        disabled={isPullingThis || isSavingThis || !!pullingModel}
                        aria-busy={isPullingThis}
                      >
                        {isPullingThis && <Spinner size="sm" />}
                        {isPullingThis ? t("downloading") : t("download")}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <SelectField label={t("manualModel")}>
        <Select
          value={selectedModel}
          onValueChange={(value) => setSelectedModel(value ?? "")}
          items={selectItems.flatMap((group) => group.items)}
        >
          <AccessibleSelectTrigger className="w-full">
            <SelectValue placeholder={t("selectModelPlaceholder")} />
          </AccessibleSelectTrigger>
          <SelectContent>
            {selectItems.map((group) => (
              <SelectGroup key={group.group}>
                <SelectLabel>{group.group}</SelectLabel>
                {group.items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </SelectField>
    </div>
  );

  if (!showApiTab) {
    return ollamaTab;
  }

  return (
    <section aria-label={t("modelSelectorLabel")} className="w-full">
      <Tabs defaultValue="ollama" className="w-full">
        <TabsList aria-label={t("modelSourceLabel")}>
          <TabsTrigger value="ollama">{t("localTab")}</TabsTrigger>
          <TabsTrigger value="external">{t("externalTab")}</TabsTrigger>
        </TabsList>
        <TabsContent value="ollama">{ollamaTab}</TabsContent>
        <TabsContent value="external">
          <ExternalApiForm onSaved={onSaved} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
