import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getDocument } from "@/modules/documents/actions";
import { getSubject } from "@/modules/subjects/actions";
import { getSummary } from "@/modules/summaries/actions";
import { SummaryDetail } from "@/modules/summaries/components/summary-detail";
import { Breadcrumb } from "@/components/breadcrumb";
import { LinkButton } from "@/components/ui/link-button";
import { ArrowLeft } from "lucide-react";

interface SummaryDetailPageProps {
  params: Promise<{ id: string; summaryId: string }>;
}

export default async function SummaryDetailPage({
  params,
}: SummaryDetailPageProps) {
  const t = await getTranslations("documents");
  const locale = await getLocale();
  const { id, summaryId } = await params;

  const [document, summary] = await Promise.all([
    getDocument(id),
    getSummary(summaryId),
  ]);

  if (!document || !summary || summary.documentId !== document.id) {
    notFound();
  }

  const subject = await getSubject(document.subjectId);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: t("dashboard"), href: "/dashboard" },
            ...(subject
              ? [
                  {
                    label: subject.folder.name,
                    href: `/folders/${subject.folderId}`,
                  },
                  { label: subject.name, href: `/subjects/${subject.id}` },
                ]
              : []),
            { label: document.title, href: `/documents/${document.id}/summaries` },
            { label: t("summary") },
          ]}
        />
        <h1 className="text-3xl font-bold tracking-tight">
          {t("summaryTitle", { title: document.title })}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("summaryGeneratedAt", {
            date: new Intl.DateTimeFormat(locale, {
              dateStyle: "long",
              timeStyle: "short",
            }).format(new Date(summary.createdAt)),
          })}
        </p>
      </div>

      <SummaryDetail
        key={summary.status}
        id={summary.id}
        documentStatus={document.status}
        content={summary.content}
        status={summary.status}
        progress={summary.progress}
        errorMessage={summary.errorMessage}
        createdAt={summary.createdAt}
      />

      <div className="flex justify-start">
        <LinkButton
          href={`/documents/${document.id}/summaries`}
          variant="outline"
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("backToSummaries")}
        </LinkButton>
      </div>
    </div>
  );
}
