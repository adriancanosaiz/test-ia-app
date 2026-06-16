import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";
import { getTests } from "@/modules/tests/actions";
import { TestForm } from "@/modules/tests/components/test-form";
import { TestList } from "@/modules/tests/components/test-list";
import { SsrErrorState } from "@/components/ssr-error-state";
import { Plus } from "lucide-react";

export default async function TestsPage() {
  const t = await getTranslations("tests");
  let tests;

  try {
    tests = await getTests();
  } catch {
    return <SsrErrorState title={t("testsLoadError")} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("testsTitle")}</h1>
          <p className="text-muted-foreground">
            {t("testsDescription")}
          </p>
        </div>
        <TestForm>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t("newTest")}
          </Button>
        </TestForm>
      </div>

      <TestList tests={tests} />
    </div>
  );
}
