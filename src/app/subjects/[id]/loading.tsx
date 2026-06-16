import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

export default async function SubjectLoading() {
  const t = await getTranslations("subjects");

  return (
    <div className="space-y-6" role="status" aria-label={t("loading")}>
      <div className="space-y-3">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="border rounded-xl p-6 space-y-6 bg-card">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
