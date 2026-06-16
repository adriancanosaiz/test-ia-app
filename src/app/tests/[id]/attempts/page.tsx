import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { getAttempts, getTest } from "@/modules/tests/actions";
import { AttemptList } from "@/modules/tests/components/attempt-list";
import { Breadcrumb } from "@/components/breadcrumb";
import { Play } from "lucide-react";

interface AttemptsPageProps {
  params: Promise<{ id: string }>;
}

export default async function AttemptsPage({ params }: AttemptsPageProps) {
  const t = await getTranslations("tests");
  const { id } = await params;
  const test = await getTest(id);

  if (!test) {
    notFound();
  }

  const attempts = await getAttempts(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Breadcrumb
            items={[
              { label: t("testsTitle"), href: "/tests" },
              { label: test.title, href: `/tests/${test.id}` },
              { label: t("attemptsTitle") },
            ]}
          />
          <h1 className="text-3xl font-bold tracking-tight">{t("attemptsTitle")}</h1>
        </div>
        <Link href={`/tests/${test.id}/attempt`}>
          <Button className="gap-2">
            <Play className="h-4 w-4" />
            {t("newAttempt")}
          </Button>
        </Link>
      </div>

      <AttemptList testId={test.id} attempts={attempts} />
    </div>
  );
}
