"use client";

import { useActionState } from "react";

import {
  submitProjectAction,
  withdrawProjectAction,
} from "@/actions/projects";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { ProjectPublicationStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  status: ProjectPublicationStatus;
  /** Current moderation setting — decides whether the button says "Publish" or "Submit for review". */
  moderation: boolean;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Publish / unpublish controls. The server re-checks ownership and the workflow
 * state, so the buttons are a convenience, never the authority.
 */
export function ProjectActions({
  projectId,
  status,
  moderation,
  size = "sm",
  className,
}: Props) {
  const [submitState, submitAction, submitPending] = useActionState(
    submitProjectAction,
    {},
  );
  const [withdrawState, withdrawAction, withdrawPending] = useActionState(
    withdrawProjectAction,
    {},
  );

  const canSubmit = status === "draft" || status === "rejected";
  const canWithdraw = [
    "submitted",
    "in_review",
    "rejected",
    "published",
  ].includes(status);
  const message = submitState.error ?? submitState.info ?? withdrawState.error ?? withdrawState.info ?? null;
  const failed = Boolean(submitState.error ?? withdrawState.error);

  const submitLabel = moderation
    ? status === "rejected"
      ? "Resubmit"
      : "Submit for review"
    : status === "rejected"
      ? "Republish"
      : "Publish";

  const withdrawLabel = moderation ? "Recall to draft" : "Unpublish";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {canSubmit && (
          <form action={submitAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <Button
              type="submit"
              variant="primary"
              size={size}
              disabled={submitPending}
              leadingIcon={
                submitPending
                  ? "progress_activity"
                  : moderation
                    ? "send"
                    : "publish"
              }
            >
              {submitPending
                ? moderation
                  ? "Submitting…"
                  : "Publishing…"
                : submitLabel}
            </Button>
          </form>
        )}

        {canWithdraw && (
          <form action={withdrawAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <Button
              type="submit"
              variant="default"
              size={size}
              disabled={withdrawPending}
              leadingIcon={withdrawPending ? "progress_activity" : "undo"}
            >
              {withdrawPending
                ? moderation
                  ? "Recalling…"
                  : "Unpublishing…"
                : withdrawLabel}
            </Button>
          </form>
        )}
      </div>

      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={cn(
            "flex items-start gap-1.5 text-xs",
            failed ? "text-gh-danger" : "text-gh-success",
          )}
        >
          <Icon
            name={failed ? "error" : "check_circle"}
            size={14}
            className="mt-px shrink-0"
          />
          <span>
            {message}
            {submitState.info && submitState.error ? ` ${submitState.info}` : ""}
          </span>
        </p>
      )}
    </div>
  );
}
