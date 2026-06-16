import { Skeleton } from "@/components/ui/skeleton";

import { getTranslations } from "next-intl/server";

export default async function ChatLoading() {
  const t = await getTranslations("chat");

  return (
    <div className="space-y-6" role="status" aria-label={t("loading")}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-3 w-full">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-9 w-44 shrink-0" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
