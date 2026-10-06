import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import type { StudentCardData } from "@/lib/data/students";
import { SOCIAL_PROVIDERS } from "@/lib/constants";
import { cn, compactNumber } from "@/lib/utils";

function iconFor(provider: string) {
  return SOCIAL_PROVIDERS.find((item) => item.value === provider)?.icon ?? "link";
}

function labelFor(provider: string) {
  return SOCIAL_PROVIDERS.find((item) => item.value === provider)?.label ?? provider;
}

/**
 * Student card from the design's "Meet the Student Builders" section.
 * Social icons render only for accounts the student actually connected.
 */
export function StudentCard({ student }: { student: StudentCardData }) {
  const meta = [
    student.department?.code ?? student.department?.name ?? null,
    student.batch ? `Batch '${String(student.batch).slice(-2)}` : null,
    student.featured ? "Dean's List" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="group flex flex-col justify-between rounded-lg border border-gh-border bg-gh-card p-6 transition-all hover:border-gh-fg-subtle">
      <div>
        <div className="mb-4 flex items-center gap-4">
          <Avatar
            name={student.name}
            src={student.avatarUrl}
            size="lg"
            verified
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-base font-semibold text-gh-fg-default">
                {student.username ? (
                  <Link href={`/students/${student.username}`} className="rounded hover:text-gh-accent">
                    {student.name}
                  </Link>
                ) : (
                  student.name
                )}
              </h3>
              <Icon name="school" size={16} tone="success" title="Verified campus student" />
            </div>
            <div className="truncate font-mono text-xs text-gh-fg-muted">{meta}</div>
          </div>
        </div>

        <p className="clamp-3 mb-4 text-xs leading-relaxed text-gh-fg-muted">
          {student.bio ?? student.headline ?? "Building on campus, one project at a time."}
        </p>

        <div className="mb-6 flex flex-wrap gap-1.5">
          {student.skills.slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="rounded border border-gh-border bg-gh-inset px-2 py-0.5 font-mono text-xs leading-4 text-gh-fg-muted"
            >
              {skill}
            </span>
          ))}
          {student.skills.length === 0 && (
            <span className="font-mono text-xs text-gh-fg-subtle">
              No skills listed yet
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-gh-border pt-4">
        <span className="font-mono text-xs text-gh-fg-muted">
          {student.projectCount} Project{student.projectCount === 1 ? "" : "s"} ·{" "}
          {compactNumber(student.totalViews)} Views
        </span>

        <div className="flex items-center gap-1">
          {student.socials.length === 0 ? (
            <span className="font-mono text-[11px] text-gh-fg-subtle">
              No social links
            </span>
          ) : (
            student.socials.map((social) => (
              <a
                key={social.provider}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${student.name} on ${labelFor(social.provider)}`}
                title={labelFor(social.provider)}
                className={cn(
                  "rounded p-1.5 text-gh-fg-muted transition-colors",
                  "hover:bg-gh-btn-hover hover:text-gh-fg-default",
                )}
              >
                <Icon name={iconFor(social.provider)} size={16} />
              </a>
            ))
          )}
        </div>
      </div>
    </article>
  );
}
