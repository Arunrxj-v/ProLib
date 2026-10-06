import Link from "next/link";

import { Section } from "@/components/home/Section";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/** Colour pairing reused from the design for tech chips. */
const TONES = [
  "text-gh-accent",
  "text-gh-success",
  "text-gh-attention",
  "text-gh-fg-muted",
];

export function TechChipBar({
  technologies,
}: {
  technologies: Array<{ name: string; slug: string; icon: string | null; projectCount: number }>;
}) {
  const total = technologies.reduce((sum, item) => sum + item.projectCount, 0);

  return (
    <Section className="py-8">
      <div className="mb-4 flex flex-col gap-4 border-b border-gh-border pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Icon name="tune" size={18} tone="accent" />
          <h2 className="text-base font-semibold text-gh-fg-default">
            Explore by Tech Stack
          </h2>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-gh-fg-muted">
          <span>{technologies.length} technologies tracked</span>
          <span className="text-gh-border">/</span>
          <Link href="/technologies" className="text-gh-accent hover:underline">
            Browse all
          </Link>
        </div>
      </div>

      {technologies.length === 0 ? (
        <p className="py-4 text-sm text-gh-fg-muted">
          Technologies appear here once projects start tagging their stacks.
        </p>
      ) : (
        <div
          data-scrollbar-none
          className="flex items-center gap-2 overflow-x-auto py-2"
        >
          <Link
            href="/explore"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-transparent bg-gh-accent-emphasis px-3 py-1 font-mono text-xs font-semibold text-white shadow-sm transition-all"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            <span>All</span>
            <span className="rounded bg-black/20 px-1 font-mono text-[10px]">
              {total}
            </span>
          </Link>

          {technologies.map((technology, index) => (
            <Link
              key={technology.slug}
              href={`/explore?technology=${technology.slug}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gh-border bg-gh-btn-bg px-3 py-1 font-mono text-xs font-medium text-gh-fg-default transition-all hover:bg-gh-btn-hover"
            >
              {technology.icon && (
                <Icon name={technology.icon} size={14} tone="inherit" className={TONES[index % TONES.length]} />
              )}
              <span>{technology.name}</span>
              <span className="rounded bg-gh-inset px-1 font-mono text-[10px] text-gh-fg-muted">
                {technology.projectCount}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

export function CategoriesGrid({
  categories,
}: {
  categories: Array<{
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    tone: string;
    projectCount: number;
  }>;
}) {
  const toneClass = (tone: string) =>
    cn(
      {
        accent: "text-gh-accent",
        success: "text-gh-success",
        attention: "text-gh-attention",
        danger: "text-gh-danger",
        done: "text-gh-done",
      }[tone] ?? "text-gh-accent",
    );

  return (
    <Section>
      <div className="mb-8">
        <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-gh-accent">
          Architecture Taxonomies
        </p>
        <h2 className="text-2xl font-semibold text-gh-fg-default">
          Explore by Category
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/explore?category=${category.slug}`}
            className="group flex items-start justify-between rounded-lg border border-gh-border bg-gh-card p-6 transition-all hover:border-gh-fg-subtle"
          >
            <div className="space-y-2">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-md border border-gh-border bg-gh-inset transition-all group-hover:bg-gh-btn-bg",
                  toneClass(category.tone),
                )}
              >
                <Icon name={category.icon ?? "category"} size={20} tone="inherit" />
              </span>
              <h3 className="text-base font-semibold text-gh-fg-default">
                {category.name}
              </h3>
              {category.description && (
                <p className="text-xs leading-relaxed text-gh-fg-muted">
                  {category.description}
                </p>
              )}
              <div
                className={cn(
                  "pt-2 font-mono text-xs font-medium",
                  toneClass(category.tone),
                )}
              >
                {category.projectCount} project
                {category.projectCount === 1 ? "" : "s"} documented
              </div>
            </div>
            <Icon
              name="chevron_right"
              size={20}
              className="text-gh-fg-subtle transition-all group-hover:translate-x-1 group-hover:text-gh-fg-default"
            />
          </Link>
        ))}
      </div>
    </Section>
  );
}
