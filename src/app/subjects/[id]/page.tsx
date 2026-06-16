import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSubject } from "@/modules/subjects/actions";
import { getDocumentsBySubject } from "@/modules/documents/actions";
import { DocumentUpload } from "@/modules/documents/components/document-upload";
import { DocumentList } from "@/modules/documents/components/document-list";
import { Breadcrumb } from "@/components/breadcrumb";
import { SsrErrorState } from "@/components/ssr-error-state";

interface SubjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function SubjectPage({ params }: SubjectPageProps) {
  const { id } = await params;
  const t = await getTranslations("subjects");
  const tNav = await getTranslations("navigation");
  let subject;
  let documents;

  try {
    subject = await getSubject(id);
    if (!subject) {
      notFound();
    }
    documents = await getDocumentsBySubject(id);
  } catch {
    return <SsrErrorState title={t("errorTitle")} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: tNav("dashboard"), href: "/dashboard" },
            {
              label: subject.folder.name,
              href: `/folders/${subject.folderId}`,
            },
            { label: subject.name },
          ]}
        />
        <h1 className="text-3xl font-bold tracking-tight">{subject.name}</h1>
        {subject.description && (
          <p className="text-muted-foreground mt-1">{subject.description}</p>
        )}
      </div>

      <div className="border rounded-xl p-6 space-y-6 bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{t("documentsSectionTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("documentsSectionDescription")}
            </p>
          </div>
        </div>
        <DocumentUpload subjectId={subject.id} />
        <DocumentList documents={documents} />
      </div>
    </div>
  );
}
