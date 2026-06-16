import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSettings } from "@/lib/settings/actions";
import { ModelSelector } from "@/modules/settings/components/model-selector";
import { SsrErrorState } from "@/components/ssr-error-state";

export default async function SetupPage() {
  const t = await getTranslations("setup");
  let settings;

  try {
    settings = await getSettings();
  } catch {
    return <SsrErrorState />;
  }

  if (settings) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("setupDescription")}</p>
      </div>
      <ModelSelector onSaved={() => redirect("/dashboard")} />
    </div>
  );
}
