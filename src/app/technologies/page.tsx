import type { Metadata } from "next";
import Link from "next/link";

import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Tag";
import { getTechnologies } from "@/lib/data/taxonomy";
import { cn, compactNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tech stacks",
  description:
    "Every technology used across the campus archive, with real project counts.",
};

const KIND_LABELS: Record<string, string> = {
  language: "Languages",
  framework: "Frameworks & libraries",
  database: "Data stores",
  infrastructure: "Infrastructure",
  ml: "Machine learning",
  hardware: "Hardware & embedded",
  tool: "Tooling",
  other: "Everything else",
};

const KIND_ORDER = [
  "language",
  "framework",
  "database",
  "infrastructure",
  "ml",
  "hardware",
  "tool",
  "other",
];

export default async function TechnologiesPage() {
  const technologies = await getTechnologies();

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    label: KIND_LABELS[kind] ?? kind,
    items: technologies.filter((technology) => technology.kind === kind),
  })).filter((group) => group.items.length > 0);

  const used = technologies.filter((item) => item.projectCount > 0);

  return (
    <div className="w-full">
      <section className="border-b border-gh-border-muted">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <Eyebrow>Stack Registry</Eyebrow>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gh-fg-default sm:text-4xl">
                Tech stacks
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gh-fg-muted">
                A live index of what the campus actually builds with. Selecting
                a stack filters the archive to every project that uses it.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gh-border bg-gh-subtle px-3 py-1 font-mono text-xs text-gh-fg-muted">
                <Icon name="terminal" size={14} tone="attention" />
                {technologies.length} registered
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(63,185,80,0.35)] bg-[rgba(63,185,80,0.1)] px-3 py-1 font-mono text-xs text-gh-success">
                <Icon name="check_circle" size={14} />
                {used.length} in use
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full">
        <div className="mx-auto max-w-7xl space-y-9 px-4 py-10 sm:px-6">
          {grouped.length === 0 && (
            <EmptyState
              icon="deployed_code"
              title="No technologies registered yet"
              description="Administrators add stacks from the admin console; students then pick them when submitting a project."
              action={
                <LinkButton href="/admin/taxonomy" variant="default">
                  Manage technologies
                </LinkButton>
              }
            />
          )}

          {grouped.map((group) => (
            <section key={group.kind} aria-labelledby={`kind-${group.kind}`}>
              <div className="mb-4 flex items-center justify-between border-b border-gh-border pb-3">
                <h2
                  id={`kind-${group.kind}`}
                  className="text-base font-semibold text-gh-fg-default"
                >
                  {group.label}
                </h2>
                <span className="font-mono text-xs text-gh-fg-muted">
                  {group.items.length}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {group.items.map((technology) => {
                  const active = technology.projectCount > 0;
                  return (
                    <Link
                      key={technology.id}
                      href={`/explore?technology=${technology.slug}`}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all",
                        active
                          ? "border-gh-border bg-gh-btn-bg text-gh-fg-default hover:border-gh-accent hover:text-gh-accent"
                          : "border-gh-border-muted bg-gh-inset text-gh-fg-subtle hover:text-gh-fg-muted",
                      )}
                      aria-disabled={!active}
                    >
                      {technology.icon && (
                        <Icon name={technology.icon} size={14} tone="accent" />
                      )}
                      <span>{technology.name}</span>
                      <span
                        className={cn(
                          "rounded bg-gh-inset px-1.5 py-0.5 font-mono text-[10px]",
                          active ? "text-gh-fg-muted" : "text-gh-fg-subtle",
                        )}
                      >
                        {compactNumber(technology.projectCount)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          <div className="rounded-lg border border-gh-border bg-gh-card p-5">
            <p className="text-sm text-gh-fg-muted">
              Stacks with a <span className="font-mono text-gh-fg-default">0</span>{" "}
              count are registered but not used by a published project yet —
              they stay selectable so students can claim them.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
