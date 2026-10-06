import type {
  ComponentPropsWithoutRef,
  ReactNode,
} from "react";

import { cn } from "@/lib/utils";

const CONTROL =
  "w-full rounded-md border border-gh-border bg-gh-inset px-3 py-2 text-sm text-gh-fg-default " +
  "placeholder:text-gh-fg-subtle transition-colors " +
  "focus:outline-none focus:border-gh-accent focus:shadow-[inset_0_0_0_1px_#58a6ff] " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

const ERROR_CONTROL = "border-gh-danger focus:border-gh-danger focus:shadow-[inset_0_0_0_1px_#f85149]";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | string[] | undefined;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const message = Array.isArray(error) ? error[0] : error;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block font-mono text-xs font-medium text-gh-fg-muted"
      >
        {label}
        {required && <span className="ml-1 text-gh-accent" aria-hidden>*</span>}
      </label>
      {children}
      {message ? (
        <p className="text-xs text-gh-danger" role="alert">
          {message}
        </p>
      ) : hint ? (
        <p className="text-xs text-gh-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  invalid,
  className,
  ...props
}: ComponentPropsWithoutRef<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={cn(CONTROL, invalid && ERROR_CONTROL, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Textarea({
  invalid,
  className,
  ...props
}: ComponentPropsWithoutRef<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(CONTROL, "min-h-28 resize-y leading-relaxed", invalid && ERROR_CONTROL, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({
  invalid,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"select"> & { invalid?: boolean }) {
  return (
    <select
      className={cn(
        CONTROL,
        "appearance-none bg-[length:0] pr-9",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%238b949e%22><path d=%22M7 10l5 5 5-5z%22/></svg>')] bg-[right_0.5rem_center] bg-no-repeat",
        invalid && ERROR_CONTROL,
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

/** Search input with the design's leading glyph. */
export function SearchInput({
  className,
  ...props
}: ComponentPropsWithoutRef<"input">) {
  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden
        className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-gh-fg-muted"
      >
        search
      </span>
      <input
        type="search"
        className={cn(CONTROL, "pl-9")}
        {...props}
      />
    </div>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: ComponentPropsWithoutRef<"input"> & {
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-md border border-transparent p-1.5 hover:border-gh-border transition-colors",
        className,
      )}
    >
      <input
        type="checkbox"
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-[3px] border border-gh-border bg-gh-inset",
          "checked:border-gh-accent-emphasis checked:bg-gh-accent-emphasis",
          "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222.5%22><path d=%22M3.5 8.5l3 3 6-6%22/></svg>')] bg-[length:14px] bg-center bg-no-repeat",
          "checked:bg-[length:14px]",
        )}
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-sm text-gh-fg-default">{label}</span>
        {description && (
          <span className="block text-xs text-gh-fg-muted">{description}</span>
        )}
      </span>
    </label>
  );
}
