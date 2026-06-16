import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { getTest } from "@/modules/tests/actions";
import { TestDetail } from "@/modules/tests/components/test-detail";
import { Breadcrumb } from "@/components/breadcrumb";
import { SsrErrorState } from "@/components/ssr-error-state";
import { Play, History } from "lucide-react";

interface TestPageProps {
  params: Promise<{ id: string }>;
}

export default async function TestPage({ params }: TestPageProps) {
  const t = await getTranslations("tests");
  const { id } = await params;
  let test;

  try {
    test = await getTest(id);
  } catch {
    return <SsrErrorState title={t("testLoadError")} />;
  }

  if (!test) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Breadcrumb
            items={[
              { label: t("testsTitle"), href: "/tests" },
              { label: test.title },
            ]}
          />
          <h1 className="text-3xl font-bold tracking-tight">{test.title}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/tests/${test.id}/attempts`}>
            <Button variant="outline" className="gap-2">
              <History className="h-4 w-4" />
              {t("viewAttempts")}
            </Button>
          </Link>
          <Link href={`/tests/${test.id}/attempt`}>
            <Button className="gap-2">
              <Play className="h-4 w-4" />
              {t("takeTest")}
            </Button>
          </Link>
        </div>
      </div>

      <TestDetail test={test} />
    </div>
  );
}
