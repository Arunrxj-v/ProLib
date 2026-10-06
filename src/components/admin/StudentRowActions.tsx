"use client";

import { useActionState, type ReactNode } from "react";

import {
  markEmailVerifiedAction,
  setStudentRoleAction,
  setStudentStatusAction,
  toggleStudentFeatureAction,
  type AdminActionState,
} from "@/actions/admin";
import { StateAlert } from "@/components/admin/StateAlert";
import { Button } from "@/components/ui/Button";

type Student = {
  id: string;
  name: string;
  role: string;
  status: string;
  featured: boolean;
  emailVerified: boolean;
};

function RowAction({
  action,
  fields,
  children,
  variant = "default",
}: {
  action: (
    prev: AdminActionState,
    formData: FormData,
  ) => Promise<AdminActionState>;
  fields: Record<string, string>;
  children: ReactNode;
  variant?: "default" | "danger" | "primary" | "accent-soft" | "ghost";
}) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    action,
    {},
  );

  return (
    <span className="inline-flex flex-col gap-1.5">
      <form action={formAction} className="flex">
        {Object.entries(fields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
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

/** Account-level controls for one row of the student directory. */
export function StudentRowActions({
  student,
  isSelf,
}: {
  student: Student;
  isSelf: boolean;
}) {
  const suspended = student.status === "suspended";
  const isAdmin = student.role === "admin";

  return (
    <div className="flex flex-wrap items-start gap-2">
      {!isSelf && (
        <RowAction
          action={setStudentStatusAction}
          fields={{ userId: student.id, status: suspended ? "active" : "suspended" }}
          variant={suspended ? "primary" : "danger"}
        >
          {suspended ? "Activate" : "Suspend"}
        </RowAction>
      )}

      {!isSelf && (
        <RowAction
          action={setStudentRoleAction}
          fields={{ userId: student.id, role: isAdmin ? "student" : "admin" }}
          variant={isAdmin ? "default" : "accent-soft"}
        >
          {isAdmin ? "Revoke admin" : "Make admin"}
        </RowAction>
      )}

      {!student.emailVerified && (
        <RowAction
          action={markEmailVerifiedAction}
          fields={{ userId: student.id }}
          variant="default"
        >
          Mark verified
        </RowAction>
      )}

      <RowAction
        action={toggleStudentFeatureAction}
        fields={{ userId: student.id }}
        variant="ghost"
      >
        {student.featured ? "Unfeature" : "Feature"}
      </RowAction>
    </div>
  );
}
