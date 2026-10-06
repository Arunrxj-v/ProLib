"use client";

import { useActionState, useState } from "react";

import { deleteProjectAction } from "@/actions/projects";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Alert, Panel, PanelHeader } from "@/components/ui/Panel";

/**
 * Deletion is permanent (projects, images and membership rows cascade), so it
 * asks the student to retype the exact title before the server will act.
 */
export function DeleteProject({
  projectId,
  title,
}: {
  projectId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteProjectAction, {});

  return (
    <Panel padded={false} className="border-[rgba(248,81,73,0.35)]">
      <PanelHeader
        title="Danger zone"
        description="Deleting removes the write-up, gallery and team links."
        className="bg-[rgba(147,0,10,0.2)]"
      />

      <div className="space-y-4 p-5">
        {state.error && <Alert tone="danger">{state.error}</Alert>}

        {!open ? (
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setOpen(true)}
            leadingIcon="delete"
          >
            Delete this project
          </Button>
        ) : (
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="projectId" value={projectId} />

            <Field
              label={
                <span>
                  Type <span className="font-mono text-gh-fg-default">{title}</span>{" "}
                  to confirm
                </span>
              }
              htmlFor="delete-confirm"
              error={state.error}
              hint="This cannot be undone."
            >
              <Input
                id="delete-confirm"
                name="confirm"
                required
                autoComplete="off"
                invalid={Boolean(state.error)}
                placeholder={title}
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                variant="danger"
                size="sm"
                disabled={pending}
                leadingIcon={pending ? "progress_activity" : "delete_forever"}
              >
                {pending ? "Deleting…" : "Delete permanently"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                leadingIcon="close"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {!open && (
          <p className="flex items-start gap-1.5 text-xs text-gh-fg-subtle">
            <Icon name="info" size={14} className="mt-px shrink-0" />
            Prefer to keep it out of the library? Recall the submission instead
            — it stays in your drafts.
          </p>
        )}
      </div>
    </Panel>
  );
}
