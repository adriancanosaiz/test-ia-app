import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { getAttempt, getAttempts } from "@/modules/tests/actions";
import { AttemptDetail } from "@/modules/tests/components/attempt-detail";
import { Breadcrumb } from "@/components/breadcrumb";
import { ArrowLeft } from "lucide-react";

interface AttemptDetailPageProps {
  params: Promise<{ id: string; attemptId: string }>;
}

export default async function AttemptDetailPage({
  params,
}: AttemptDetailPageProps) {
  const t = await getTranslations("tests");
  const { id, attemptId } = await params;
  const [attempt, attempts] = await Promise.all([
    getAttempt(attemptId),
    getAttempts(id),
  ]);

  if (!attempt || attempt.testId !== id) {
    notFound();
  }

  const sortedAttempts = [...attempts].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );
  const attemptNumber =
    sortedAttempts.findIndex((a) => a.id === attemptId) + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Breadcrumb
            items={[
              { label: t("testsTitle"), href: "/tests" },
              { label: attempt.test.title, href: `/tests/${id}` },
              { label: t("attemptsTitle"), href: `/tests/${id}/attempts` },
              { label: t("correctionTitle") },
            ]}
          />
          <h1 className="text-3xl font-bold tracking-tight">{t("correctionTitle")}</h1>
        </div>
        <Link href={`/tests/${id}/attempts`}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("backToAttempts")}
          </Button>
        </Link>
      </div>

      <AttemptDetail attempt={attempt} number={attemptNumber} />
    </div>
  );
}
