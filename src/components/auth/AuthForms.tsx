"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  loginAction,
  resendVerificationAction,
  signupAction,
  type AuthState,
} from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Alert } from "@/components/ui/Panel";
import { PASSWORD_MIN } from "@/lib/auth/validation";
import { cn } from "@/lib/utils";

type DepartmentOption = { id: string; name: string };

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function ErrorSummary({ state }: { state: AuthState }) {
  if (state.error) {
    return (
      <Alert tone="danger" title={state.error}>
        {state.info && <p>{state.info}</p>}
        {state.needsVerification && (
          <Link
            href={`/verify-email?email=${encodeURIComponent(
              state.values?.email ?? "",
            )}`}
            className="mt-1 inline-block font-medium text-gh-accent hover:underline"
          >
            Send a new confirmation link
          </Link>
        )}
      </Alert>
    );
  }
  if (state.info) {
    return <Alert tone="success">{state.info}</Alert>;
  }
  return null;
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  error,
  hint,
  required = true,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required}>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          invalid={Boolean(error)}
          minLength={required ? PASSWORD_MIN : undefined}
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gh-fg-muted transition-colors hover:text-gh-fg-default"
        >
          <Icon name={visible ? "visibility_off" : "visibility"} size={18} />
        </button>
      </div>
    </Field>
  );
}

function SubmitButton({
  pending,
  idle,
  working,
}: {
  pending: boolean;
  idle: string;
  working: string;
}) {
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      block
      disabled={pending}
      className="mt-1"
      leadingIcon={pending ? "progress_activity" : undefined}
    >
      {pending ? working : idle}
    </Button>
  );
}

/** Real Google sign-in — only rendered when credentials exist in the env. */
export function GoogleButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gh-border bg-gh-btn-bg px-4 py-2.5 text-sm font-medium text-gh-fg-default transition-colors hover:bg-gh-btn-hover"
    >
      <svg aria-hidden width="16" height="16" viewBox="0 0 48 48">
        <path
          fill="#FFC107"
          d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
        />
        <path
          fill="#FF3D00"
          d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C36.9 40.2 44 35 44 24c0-1.3-.1-2.6-.4-3.9z"
        />
      </svg>
      Continue with Google
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Sign in                                                             */
/* ------------------------------------------------------------------ */

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <ErrorSummary state={state} />

      <Field
        label="College email"
        htmlFor="login-email"
        error={state.fieldErrors?.email}
        required
      >
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          invalid={Boolean(state.fieldErrors?.email)}
          defaultValue={state.values?.email ?? ""}
          placeholder="you@student.prolib.edu"
        />
      </Field>

      <PasswordField
        id="login-password"
        name="password"
        label="Password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />

      {next && <input type="hidden" name="next" value={next} />}

      <div className="flex items-center justify-between gap-3">
        <Link
          href="/verify-email"
          className="text-xs font-medium text-gh-accent hover:underline"
        >
          Need a new confirmation link?
        </Link>
      </div>

      <SubmitButton
        pending={pending}
        idle="Sign in"
        working="Signing in…"
      />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Create account                                                      */
/* ------------------------------------------------------------------ */

export function SignupForm({
  departments,
  next,
}: {
  departments: DepartmentOption[];
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(signupAction, {});
  const values = state.values ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <ErrorSummary state={state} />

      <Field
        label="Full name"
        htmlFor="signup-name"
        error={state.fieldErrors?.name}
        required
      >
        <Input
          id="signup-name"
          name="name"
          autoComplete="name"
          required
          invalid={Boolean(state.fieldErrors?.name)}
          defaultValue={values.name ?? ""}
          placeholder="Your full name"
        />
      </Field>

      <Field
        label="Profile handle"
        htmlFor="signup-username"
        hint="Used for your public profile: /students/handle"
        error={state.fieldErrors?.username}
        required
      >
        <Input
          id="signup-username"
          name="username"
          autoComplete="username"
          required
          invalid={Boolean(state.fieldErrors?.username)}
          defaultValue={values.username ?? ""}
          placeholder="yourhandle"
        />
      </Field>

      <Field
        label="College email"
        htmlFor="signup-email"
        hint="Confirmation link goes here — the domain may be restricted by your college."
        error={state.fieldErrors?.email}
        required
      >
        <Input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          invalid={Boolean(state.fieldErrors?.email)}
          defaultValue={values.email ?? ""}
          placeholder="you@student.prolib.edu"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Department"
          htmlFor="signup-department"
          error={state.fieldErrors?.departmentId}
        >
          <Select
            id="signup-department"
            name="departmentId"
            defaultValue={values.departmentId ?? ""}
            invalid={Boolean(state.fieldErrors?.departmentId)}
          >
            <option value="">Prefer not to say yet</option>
            {departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Graduation year"
          htmlFor="signup-batch"
          error={state.fieldErrors?.batch}
        >
          <Input
            id="signup-batch"
            name="batch"
            inputMode="numeric"
            type="number"
            min={2000}
            defaultValue={values.batch ?? ""}
            invalid={Boolean(state.fieldErrors?.batch)}
            placeholder="2026"
          />
        </Field>
      </div>

      <PasswordField
        id="signup-password"
        name="password"
        label="Password"
        autoComplete="new-password"
        error={state.fieldErrors?.password}
        hint={`At least ${PASSWORD_MIN} characters, mixing letters and numbers.`}
      />

      <PasswordField
        id="signup-confirm"
        name="confirm"
        label="Confirm password"
        autoComplete="new-password"
        error={state.fieldErrors?.confirm}
      />

      <Field label="Guidelines" htmlFor="signup-terms" error={state.fieldErrors?.terms}>
        <Checkbox
          id="signup-terms"
          name="terms"
          value="on"
          defaultChecked={Boolean(values.terms)}
          label="I will only upload work my team is allowed to share."
          description="Submissions are reviewed by a department moderator before they appear publicly."
        />
      </Field>

      {next && <input type="hidden" name="next" value={next} />}

      <SubmitButton
        pending={pending}
        idle="Create account"
        working="Creating account…"
      />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* College email confirmation                                          */
/* ------------------------------------------------------------------ */

export function ResendForm({
  email,
  editable = true,
  next,
}: {
  email?: string;
  editable?: boolean;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(
    resendVerificationAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <ErrorSummary state={state} />

      {editable ? (
        <Field
          label="College email"
          htmlFor="resend-email"
          error={state.fieldErrors?.email}
          required
        >
          <Input
            id="resend-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            invalid={Boolean(state.fieldErrors?.email)}
            defaultValue={state.values?.email ?? email ?? ""}
            placeholder="you@student.prolib.edu"
          />
        </Field>
      ) : (
        <input type="hidden" name="email" value={email ?? ""} />
      )}

      {next && <input type="hidden" name="next" value={next} />}

      <SubmitButton
        pending={pending}
        idle={editable ? "Send a new link" : "Resend confirmation email"}
        working="Sending…"
      />

      {state.devVerifyUrl && (
        <p className={cn("text-xs leading-relaxed text-gh-fg-subtle")}>
          Development mode — no mail transport is configured, so{" "}
          <a
            href={state.devVerifyUrl}
            className="text-gh-accent underline underline-offset-2"
          >
            open the confirmation link directly
          </a>
          .
        </p>
      )}
    </form>
  );
}
