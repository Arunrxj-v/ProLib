"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";

import { submitReportAction, type ReportActionState } from "@/actions/report";
import { StateAlert } from "@/components/admin/StateAlert";
import { LinkButton } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Form";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { REPORT_REASONS } from "@/lib/reporting";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-[rgba(240,246,252,0.1)] bg-gh-btn-primary px-3 text-sm font-semibold text-white transition-all hover:bg-gh-btn-primary-hover disabled:pointer-events-none disabled:opacity-50"
    >
      {pending ? "Sending report…" : "Send report"}
    </button>
  );
}

function Thanks({ slug, message }: { slug: string; message: string }) {
  return (
    <Panel padded={false}>
      <PanelHeader
        title="Report received"
        description="It is now in the moderation queue."
      />
      <div className="space-y-4 p-5">
        <p className="text-sm leading-relaxed text-gh-fg-muted">{message}</p>
        <div className="flex flex-wrap gap-2">
          <LinkButton
            href={`/projects/${slug}`}
            variant="default"
            leadingIcon="arrow_back"
          >
            Back to the project
          </LinkButton>
          <LinkButton href="/explore" variant="ghost" leadingIcon="explore">
            Keep browsing
          </LinkButton>
        </div>
      </div>
    </Panel>
  );
}

/**
 * Public flag form for `/report/[slug]`. Anonymous submissions are allowed —
 * the server enforces visibility, de-duplication and the rate limit; this
 * component only renders the copy and the reason list.
 */
export function ReportForm({
  slug,
  title,
  signedIn,
}: {
  slug: string;
  title: string;
  signedIn: boolean;
}) {
  const [state, action] = useActionState<ReportActionState, FormData>(
    submitReportAction,
    {},
  );
  const errors = state.fieldErrors ?? {};
  const details = state.values?.details ?? "";

  if (state.info) {
    return <Thanks slug={slug} message={state.info} />;
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      <StateAlert state={state} />

      <fieldset className="space-y-2">
        <legend className="mb-2 font-mono text-xs font-medium text-gh-fg-muted">
          What is wrong with “{title}”?
          <span className="ml-1 text-gh-accent" aria-hidden>
            *
          </span>
        </legend>

        <div className="space-y-2">
          {REPORT_REASONS.map((reason) => (
            <label
              key={reason.value}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-gh-border bg-gh-inset px-3.5 py-3 transition-colors has-[:checked]:border-gh-accent has-[:checked]:bg-[rgba(56,139,253,0.08)] hover:border-gh-fg-subtle"
            >
              <input
                type="radio"
                name="reason"
                value={reason.value}
                required
                defaultChecked={state.values?.reason === reason.value}
                className="mt-1 h-4 w-4 shrink-0 accent-[#58a6ff]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gh-fg-default">
                  {reason.label}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-gh-fg-muted">
                  {reason.hint}
                </span>
              </span>
            </label>
          ))}
        </div>

        {errors.reason && (
          <p className="text-xs text-gh-danger" role="alert">
            {errors.reason}
          </p>
        )}
      </fieldset>

      <Field
        label="Anything the moderators should know?"
        htmlFor="report-details"
        error={errors.details}
        hint={`Optional · up to 1,000 characters · ${details.length}/1000`}
      >
        <Textarea
          id="report-details"
          name="details"
          rows={4}
          maxLength={1000}
          defaultValue={details}
          invalid={Boolean(errors.details)}
          placeholder="Link to the original work, or describe what looks wrong."
        />
      </Field>

      <div className="flex flex-col gap-3 border-t border-gh-border pt-4 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-xl text-xs leading-relaxed text-gh-fg-muted">
          {signedIn
            ? "Your report is sent with your account so moderators can follow up. It never appears on the public project page."
            : "Reports are sent anonymously. Your address is only used to stop repeat abuse — nothing about this report is shown publicly."}
        </p>
        <SubmitButton />
      </div>

      <p className="text-xs text-gh-fg-subtle">
        Changed your mind?{" "}
        <Link href={`/projects/${slug}`} className="text-gh-accent hover:underline">
          Open the project page
        </Link>{" "}
        or contact the moderators listed in the footer.
      </p>
    </form>
  );
}
