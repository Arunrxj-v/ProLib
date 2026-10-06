import { Skeleton } from "@/components/ui/Panel";

export default function TechnologiesLoading() {
  return (
    <div className="w-full">
      <section className="border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <Skeleton className="mb-3 h-4 w-36" />
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <Skeleton className="h-9 w-56" />
              <Skeleton className="h-4 w-full max-w-2xl" />
              <Skeleton className="h-4 w-3/4 max-w-xl" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-7 w-32 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      <section className="w-full">
        <div className="mx-auto max-w-7xl space-y-9 px-4 py-10 sm:px-6">
          {Array.from({ length: 3 }).map((_, groupIndex) => (
            <div key={groupIndex}>
              <div className="mb-4 flex items-center justify-between border-b border-gh-border pb-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-6" />
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="h-8 rounded-md"
                    style={{ width: `${74 + ((index * 13) % 42)}px` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
