"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  const t = useTranslations("common");

  return (
    <div className="space-y-8" role="status" aria-label={t("loadingContent")}>
      <div className="space-y-3">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
