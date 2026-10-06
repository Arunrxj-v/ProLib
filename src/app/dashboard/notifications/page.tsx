import type { Metadata } from "next";
import Link from "next/link";

import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState, Panel } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Tag";
import { requireUser } from "@/lib/auth/guards";
import { getReviewActivity } from "@/lib/data/myProjects";
import { formatDate, relativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Activity",
  description: "Submission and moderation history for your projects.",
};

const COPY: Record<string, string> = {
  submitted: "Submitted for review.",
  in_review: "A moderator picked this up.",
  approved: "Approved — it can now be published.",
  published: "Live in the public library.",
  rejected: "Sent back with a note from the moderator.",
  draft: "Recalled to your drafts.",
};

export default async function ActivityPage() {
  const user = await requireUser("/dashboard/notifications");
  const events = await getReviewActivity(user.id);

  return (
    <div className="w-full py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-gh-border pb-5">
        <div>
          <Eyebrow>Moderation trail</Eyebrow>
          <h1 className="text-2xl font-bold tracking-tight text-gh-fg-default">
            Review activity
          </h1>
          <p className="mt-1 text-sm text-gh-fg-muted">
            Everything that happened to your submissions, newest first.
          </p>
        </div>
        <LinkButton href="/dashboard/projects" variant="default" leadingIcon="folder">
          Manage projects
        </LinkButton>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="Nothing has been submitted yet"
          description="Once you send a project for review, every decision and note shows up here."
          action={
            <LinkButton href="/dashboard/projects/new" variant="default" leadingIcon="add">
              Create a project
            </LinkButton>
          }
        />
      ) : (
        <ol className="space-y-4">
          {events.map((event) => {
            const at = event.reviewedAt ?? event.submittedAt;
            return (
              <li key={event.projectId}>
                <Panel className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/projects/${event.projectId}/edit`}
                          className="text-sm font-semibold text-gh-fg-default hover:text-gh-accent"
                        >
                          {event.title}
                        </Link>
                        <StatusBadge status={event.publicationStatus} />
                      </div>
                      <p className="mt-1 text-sm text-gh-fg-muted">
                        {COPY[event.publicationStatus] ?? "Status updated."}
                      </p>
                      {event.reviewNote && (
                        <p className="mt-2 rounded-md border border-gh-border bg-gh-inset px-3 py-2 text-xs leading-relaxed text-gh-fg-default">
                          <span className="font-semibold text-gh-fg-muted">
                            Moderator note:
                          </span>{" "}
                          {event.reviewNote}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right font-mono text-[11px] text-gh-fg-subtle">
                      <p className="flex items-center justify-end gap-1">
                        <Icon name="schedule" size={13} />
                        {at ? relativeTime(at) : "—"}
                      </p>
                      <p className="mt-0.5">{at ? formatDate(at) : ""}</p>
                    </div>
                  </div>

                  {event.publicationStatus === "rejected" && (
                    <div className="mt-3 flex justify-end">
                      <LinkButton
                        href={`/dashboard/projects/${event.projectId}/edit`}
                        size="sm"
                        variant="default"
                        leadingIcon="edit"
                      >
                        Address the note
                      </LinkButton>
                    </div>
                  )}
                </Panel>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
