import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDocument } from "@/modules/documents/actions";
import { getSubject } from "@/modules/subjects/actions";
import { getSummariesByDocument } from "@/modules/summaries/actions";
import { SummaryList } from "@/modules/summaries/components/summary-list";
import { GenerateSummaryButton } from "@/modules/summaries/components/generate-summary-button";
import { Breadcrumb } from "@/components/breadcrumb";
import { LinkButton } from "@/components/ui/link-button";
import { ArrowLeft } from "lucide-react";

interface SummariesPageProps {
  params: Promise<{ id: string }>;
}

export default async function SummariesPage({ params }: SummariesPageProps) {
  const t = await getTranslations("documents");
  const { id } = await params;

  const [document, summaries] = await Promise.all([
    getDocument(id),
    getSummariesByDocument(id),
  ]);

  if (!document) {
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
                  { label: subject.folder.name, href: `/folders/${subject.folderId}` },
                  { label: subject.name, href: `/subjects/${subject.id}` },
                ]
              : []),
            { label: document.title },
            { label: t("summaries") },
          ]}
        />
        <h1 className="text-3xl font-bold tracking-tight">
          {t("summariesTitle", { title: document.title })}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("summariesDescription")}
        </p>
      </div>

      <div className="border rounded-xl p-6 space-y-6 bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {t("summariesGeneratedTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("summariesGeneratedDescription")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <GenerateSummaryButton
              documentId={document.id}
              status={document.status}
            />
            <LinkButton
              href={subject ? `/subjects/${subject.id}` : "/dashboard"}
              variant="outline"
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("backToSubject")}
            </LinkButton>
          </div>
        </div>

        <SummaryList
          documentId={document.id}
          documentStatus={document.status}
          summaries={summaries}
        />
      </div>
    </div>
  );
}
