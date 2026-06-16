import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getTest } from "@/modules/tests/actions";
import { AttemptForm } from "@/modules/tests/components/attempt-form";
import { Breadcrumb } from "@/components/breadcrumb";

interface AttemptPageProps {
  params: Promise<{ id: string }>;
}

export default async function AttemptPage({ params }: AttemptPageProps) {
  const t = await getTranslations("tests");
  const { id } = await params;
  const test = await getTest(id);

  if (!test) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: t("testsTitle"), href: "/tests" },
            { label: test.title, href: `/tests/${test.id}` },
            { label: t("takeTest") },
          ]}
        />
        <h1 className="text-3xl font-bold tracking-tight">{test.title}</h1>
        <p className="text-muted-foreground mt-1">
          {t("attemptSubtitle")}
        </p>
      </div>

      <AttemptForm
        testId={test.id}
        questions={test.questions.map((q) => ({
          id: q.id,
          type: q.type,
          content: q.content,
          options: q.options.map((o) => ({
            id: o.id,
            text: o.text,
            index: o.index,
          })),
        }))}
      />
    </div>
  );
}
