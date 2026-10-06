"use client";

import { useActionState, type ReactNode } from "react";

import {
  approveProjectAction,
  publishProjectAction,
  rejectProjectAction,
  toggleProjectFeatureAction,
  unpublishProjectAction,
  type AdminActionState,
} from "@/actions/admin";
import { StateAlert } from "@/components/admin/StateAlert";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Form";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PUBLICATION_STATUSES, type ProjectPublicationStatus } from "@/lib/constants";

function labelFor(status: ProjectPublicationStatus): string {
  return (
    PUBLICATION_STATUSES.find((item) => item.value === status)?.label ?? status
  );
}

function Submit({
  pending,
  children,
  variant = "primary",
}: {
  pending: boolean;
  children: ReactNode;
  variant?: "primary" | "danger" | "default";
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      size="md"
      disabled={pending}
      leadingIcon={pending ? "progress_activity" : undefined}
    >
      {children}
    </Button>
  );
}

function ApproveForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    approveProjectAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <StateAlert state={state} />
      <Field
        label="Review note (optional)"
        htmlFor="approve-note"
        hint="Stored with the decision and shown to the team."
      >
        <Textarea
          id="approve-note"
          name="note"
          rows={3}
          placeholder="Solid architecture section — nice work."
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Submit pending={pending}>Approve</Submit>
        <p className="self-center font-mono text-[11px] text-gh-fg-subtle">
          submitted · in review · rejected
        </p>
      </div>
    </form>
  );
}

function RejectForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    rejectProjectAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <StateAlert state={state} />
      <Field
        label="Reason (required)"
        htmlFor="reject-reason"
        hint="Sent back to the student as the review note — be specific."
        error={state.fieldErrors?.reason}
        required
      >
        <Textarea
          id="reject-reason"
          name="reason"
          rows={3}
          required
          invalid={Boolean(state.fieldErrors?.reason)}
          defaultValue={state.values?.reason ?? ""}
          placeholder="The problem statement is missing and two screenshots are broken."
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Submit pending={pending} variant="danger">
          Reject / request changes
        </Submit>
      </div>
    </form>
  );
}

function PublishForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    publishProjectAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <StateAlert state={state} />
      <Field
        label="Publish note (optional)"
        htmlFor="publish-note"
        hint="Appended to the review trail when it goes live."
      >
        <Textarea
          id="publish-note"
          name="note"
          rows={2}
          placeholder="Approved for the spring showcase."
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Submit pending={pending}>Publish to the library</Submit>
      </div>
    </form>
  );
}

function UnpublishForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    unpublishProjectAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <StateAlert state={state} />
      <div className="flex flex-wrap gap-2">
        <Submit pending={pending} variant="default">
          Unpublish
        </Submit>
        <p className="self-center text-xs text-gh-fg-muted">
          Keeps the approval but removes it from the public library.
        </p>
      </div>
    </form>
  );
}

function FeatureForm({
  projectId,
  featured,
}: {
  projectId: string;
  featured: boolean;
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    toggleProjectFeatureAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <StateAlert state={state} />
      <div className="flex flex-wrap gap-2">
        <Submit pending={pending} variant="default">
          {featured ? "Remove from showcase" : "Feature in showcase"}
        </Submit>
      </div>
    </form>
  );
}

/**
 * All moderation controls for one project. The server re-validates every
 * transition — these flags only shape which controls are worth showing.
 */
export function ReviewActions({
  projectId,
  status,
  featured,
}: {
  projectId: string;
  status: ProjectPublicationStatus;
  featured: boolean;
}) {
  const canApprove = ["submitted", "in_review", "rejected"].includes(status);
  const canReject = status !== "draft" && status !== "rejected";
  const canPublish = status !== "published";
  const canUnpublish = status === "published";

  return (
    <Panel padded={false} className="self-start">
      <PanelHeader
        title="Moderation"
        description={`Current status: ${labelFor(status)}`}
      />
      <div className="divide-y divide-gh-border-muted">
        {canReject && (
          <div className="p-5">
            <RejectForm projectId={projectId} />
          </div>
        )}
        {canApprove && (
          <div className="p-5">
            <ApproveForm projectId={projectId} />
          </div>
        )}
        {canPublish && (
          <div className="p-5">
            <PublishForm projectId={projectId} />
          </div>
        )}
        {canUnpublish && (
          <div className="p-5">
            <UnpublishForm projectId={projectId} />
          </div>
        )}
        <div className="p-5">
          <FeatureForm projectId={projectId} featured={featured} />
        </div>
      </div>
    </Panel>
  );
}
