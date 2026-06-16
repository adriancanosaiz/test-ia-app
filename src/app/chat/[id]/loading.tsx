import { Skeleton } from "@/components/ui/skeleton";

import { getTranslations } from "next-intl/server";

export default async function ChatSessionLoading() {
  const t = await getTranslations("chat");

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[calc(100vh-8rem)]"
      role="status"
      aria-label={t("loadingSession")}
    >
      <aside className="md:col-span-4 lg:col-span-3 flex flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="flex-1 space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </aside>

      <main className="md:col-span-8 lg:col-span-9 flex flex-col min-h-0 space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="flex-1" />
        <Skeleton className="h-20" />
      </main>
    </div>
  );
}
