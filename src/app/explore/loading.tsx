import { ProjectCardSkeleton, Skeleton } from "@/components/ui/Panel";

export default function ExploreLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <Skeleton className="mb-3 h-4 w-32" />
      <Skeleton className="h-9 w-72" />
      <Skeleton className="mt-3 h-4 w-full max-w-2xl" />

      <Skeleton className="mt-7 h-10 w-full rounded-md" />

      <div className="mt-6 grid gap-6 lg:grid-cols-[268px_minmax(0,1fr)]">
        <div className="space-y-3 rounded-lg border border-gh-border bg-gh-card p-4">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
          <Skeleton className="mt-4 h-9 w-full rounded-md" />
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-56 rounded-md" />
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <ProjectCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
