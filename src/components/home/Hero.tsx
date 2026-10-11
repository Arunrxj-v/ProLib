import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Panel";
import { getLibraryStats } from "@/lib/data/stats";
import { compactNumber } from "@/lib/utils";
import { SITE } from "@/lib/constants";

const METRICS = [
  { key: "projects", icon: "folder_special", tone: "text-gh-accent", label: "Documented Projects" },
  { key: "students", icon: "groups", tone: "text-gh-success", label: "Student Builders" },
  { key: "technologies", icon: "terminal", tone: "text-gh-attention", label: "Active Tech Stacks" },
  { key: "repositories", icon: "source_environment", tone: "text-gh-accent", label: "Open Source Repos" },
] as const;

export async function Hero() {
  const stats = await getLibraryStats();

  return (
    <section className="w-full border-b border-gh-border-muted pb-12 pt-8 lg:pb-16 lg:pt-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Headline + actions */}
        <div className="mb-10 grid grid-cols-1 items-end gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h1 className="mb-5 text-4xl font-bold tracking-tight text-gh-fg-default lg:text-5xl">
              Discover what your college is{" "}
              <span className="text-gh-accent">building.</span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-gh-fg-muted">
              {SITE.description}
            </p>
          </div>

          <div className="flex flex-col justify-end gap-3 sm:flex-row lg:col-span-4 lg:flex-col">
            <LinkButton
              href="/explore"
              variant="primary"
              size="lg"
              trailingIcon="arrow_forward"
              className="group"
            >
              Explore {compactNumber(stats.projects)} Projects
            </LinkButton>
            <LinkButton
              href="/dashboard/projects/new"
              variant="default"
              size="lg"
              leadingIcon="cloud_upload"
            >
              Showcase Your Project
            </LinkButton>
          </div>
        </div>

        {/* Campus metrics */}
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-gh-border bg-gh-subtle p-4 md:grid-cols-4">
          {METRICS.map((metric) => {
            const value = stats[metric.key];
            const formatted = metric.key === "repositories" ? String(value) : compactNumber(value);
            return (
              <div
                key={metric.key}
                className="flex items-center gap-3.5 rounded-md border border-gh-border-muted bg-gh-inset p-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gh-border bg-gh-subtle">
                  <Icon name={metric.icon} size={20} tone="inherit" className={metric.tone} />
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-bold tracking-tight text-gh-fg-default">
                    {formatted}
                    <span className="font-normal text-gh-accent">+</span>
                  </div>
                  <div className="truncate font-mono text-[11px] uppercase tracking-wider text-gh-fg-muted">
                    {metric.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function HeroSkeleton() {
  return (
    <section className="w-full border-b border-gh-border-muted pb-12 pt-8 lg:pb-16 lg:pt-14">
      <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <Skeleton className="h-12 w-4/5" />
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-5 w-2/5" />
          </div>
          <div className="space-y-3 lg:col-span-4">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      </div>
    </section>
  );
}
