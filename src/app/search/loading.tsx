import { ProjectGridSkeleton, Skeleton } from "@/components/ui/Panel";

export default function SearchLoading() {
  return (
    <div className="w-full">
      <section className="border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <Skeleton className="mb-3 h-4 w-36" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="mt-6 h-10 w-full rounded-md" />
        </div>
      </section>

      <section className="w-full border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <Skeleton className="mb-5 h-4 w-44" />
          <ProjectGridSkeleton count={6} />
          <Skeleton className="mt-8 h-9 w-64 rounded-md" />
        </div>
      </section>

      <section className="w-full border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <Skeleton className="mb-5 h-4 w-44" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="space-y-3 rounded-lg border border-gh-border bg-gh-card p-5"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <Skeleton className="mb-5 h-4 w-44" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="h-7 w-24 rounded-full" />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
