import { Skeleton } from "@/components/ui/Panel";

export default function CategoriesLoading() {
  return (
    <div className="w-full">
      <section className="border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <Skeleton className="mb-3 h-4 w-44" />
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-4 w-full max-w-2xl" />
              <Skeleton className="h-4 w-3/4 max-w-xl" />
            </div>
            <Skeleton className="h-10 w-40 rounded-md" />
          </div>
        </div>
      </section>

      <section className="w-full border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="flex items-start justify-between gap-4 rounded-lg border border-gh-border bg-gh-card p-6"
              >
                <div className="space-y-2.5">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="mt-2 h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-5 rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
