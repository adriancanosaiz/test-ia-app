import { ModelSelector } from "@/modules/settings/components/model-selector";
import { LanguageSelector } from "@/modules/settings/components/language-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import { getEffectiveSettings } from "@/lib/settings/actions";
import { getTranslations } from "next-intl/server";

const EMBEDDING_MODEL = "nomic-embed-text";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const settings = await getEffectiveSettings();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base font-medium">
            {t("language")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LanguageSelector settings={settings} />
        </CardContent>
      </Card>

      <ModelSelector />

      <Card>
        <CardHeader>
          <CardTitle
            as="h2"
            className="flex items-center gap-2 text-base font-medium"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
            {t("embeddingsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("embeddingsDescription", { model: EMBEDDING_MODEL })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
