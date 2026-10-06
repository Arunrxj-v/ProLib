"use client";

import { useActionState, type ReactNode } from "react";

import {
  dismissReportAction,
  resolveReportAction,
  type AdminActionState,
} from "@/actions/admin";
import { StateAlert } from "@/components/admin/StateAlert";
import { Button } from "@/components/ui/Button";

function ReportAction({
  action,
  reportId,
  children,
  variant,
}: {
  action: (
    prev: AdminActionState,
    formData: FormData,
  ) => Promise<AdminActionState>;
  reportId: string;
  children: ReactNode;
  variant: "primary" | "default";
}) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    action,
    {},
  );

  return (
    <span className="inline-flex flex-col gap-1.5">
      <form action={formAction} className="flex">
        <input type="hidden" name="reportId" value={reportId} />
        <Button
          type="submit"
          variant={variant}
          size="sm"
          disabled={pending}
          leadingIcon={pending ? "progress_activity" : undefined}
        >
          {children}
        </Button>
      </form>
      <StateAlert state={state} />
    </span>
  );
}

/** Resolve / dismiss controls for one row of the report queue. */
export function ReportRowActions({ reportId }: { reportId: string }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <ReportAction
        action={resolveReportAction}
        reportId={reportId}
        variant="primary"
      >
        Resolve
      </ReportAction>
      <ReportAction
        action={dismissReportAction}
        reportId={reportId}
        variant="default"
      >
        Dismiss
      </ReportAction>
    </div>
  );
}
