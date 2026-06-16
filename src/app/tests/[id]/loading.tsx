import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

export default async function TestLoading() {
  const t = await getTranslations("tests");

  return (
    <div className="space-y-6" role="status" aria-label={t("loadingTestAriaLabel")}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-3 w-full">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-1/2" />
        </div>
        <div className="flex gap-2 shrink-0">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
