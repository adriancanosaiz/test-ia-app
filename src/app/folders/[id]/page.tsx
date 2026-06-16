import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { getFolder } from "@/modules/folders/actions";
import { SubjectForm } from "@/modules/subjects/components/subject-form";
import { SubjectList } from "@/modules/subjects/components/subject-list";
import { Breadcrumb } from "@/components/breadcrumb";
import { SsrErrorState } from "@/components/ssr-error-state";
import { Plus } from "lucide-react";

interface FolderPageProps {
  params: Promise<{ id: string }>;
}

export default async function FolderPage({ params }: FolderPageProps) {
  const { id } = await params;
  const t = await getTranslations("folders");
  const tNav = await getTranslations("navigation");
  let folder;

  try {
    folder = await getFolder(id);
  } catch {
    return <SsrErrorState title={t("errorTitle")} />;
  }

  if (!folder) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Breadcrumb
            items={[
              { label: tNav("dashboard"), href: "/dashboard" },
              { label: folder.name },
            ]}
          />
          <h1 className="text-3xl font-bold tracking-tight">{folder.name}</h1>
          {folder.description && (
            <p className="text-muted-foreground mt-1">{folder.description}</p>
          )}
        </div>
        <SubjectForm folderId={folder.id}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t("newSubject")}
          </Button>
        </SubjectForm>
      </div>

      <SubjectList folderId={folder.id} subjects={folder.subjects} />
    </div>
  );
}
