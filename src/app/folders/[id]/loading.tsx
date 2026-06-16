import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

export default async function FolderLoading() {
  const t = await getTranslations("folders");

  return (
    <div className="space-y-6" role="status" aria-label={t("loading")}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-3 w-full">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-9 w-40 shrink-0" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
