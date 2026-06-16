import { getTranslations } from "next-intl/server";
import { FileQuestion } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";

export default async function NotFoundPage() {
  const t = await getTranslations("errors");

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-6">
        <FileQuestion className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">
        {t("notFoundTitle")}
      </h1>
      <p className="text-muted-foreground max-w-md mb-8">
        {t("notFoundDescription")}
      </p>
      <LinkButton href="/dashboard" size="lg">
        {t("backToDashboard")}
      </LinkButton>
    </div>
  );
}
