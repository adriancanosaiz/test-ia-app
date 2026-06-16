import { Skeleton } from "@/components/ui/skeleton";

export default function TestsLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando tests">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-3 w-full">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-9 w-36 shrink-0" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
