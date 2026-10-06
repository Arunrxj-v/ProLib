"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createTaxonomyItemAction,
  deleteTaxonomyItemAction,
  renameTaxonomyItemAction,
  toggleTaxonomyActiveAction,
  type AdminActionState,
} from "@/actions/admin";
import { StateAlert } from "@/components/admin/StateAlert";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Form";
import { Alert, Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Tag";

/**
 * Client-side mirror of `TaxonomyAdminRow` (type-only — the data module stays
 * out of the browser bundle because it opens a database connection).
 */
export type TaxonomyRow = {
  id: string;
  name: string;
  slug: string;
  meta: string | null;
  active: boolean | null;
  position: number;
  usageCount: number;
};

const KINDS = [
  { value: "department", label: "Departments" },
  { value: "category", label: "Categories" },
  { value: "technology", label: "Technologies" },
  { value: "academic_year", label: "Academic years" },
  { value: "semester", label: "Semesters" },
] as const;

type Kind = (typeof KINDS)[number]["value"];

const TECHNOLOGY_KINDS = [
  "framework",
  "language",
  "library",
  "tool",
  "database",
  "infrastructure",
  "hardware",
  "ml",
  "other",
];

const usageNoun = (kind: Kind, count: number): string => {
  const plural = count === 1 ? "" : "s";
  if (kind === "technology") return `project link${plural}`;
  if (kind === "department") return `project or student profile${plural}`;
  return `project${plural}`;
};

function SubmitButton({
  pendingLabel,
  variant = "primary",
  children,
}: {
  pendingLabel: string;
  variant?: "primary" | "default" | "danger" | "ghost";
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

function CreateForm({ kind }: { kind: Kind }) {
  const [state, action] = useActionState<AdminActionState, FormData>(
    createTaxonomyItemAction,
    {},
  );
  const [current, setCurrent] = useState<Kind>(kind);
  const errors = state.fieldErrors ?? {};

  return (
    <Panel padded={false}>
      <PanelHeader
        title="Add an entry"
        description="New entries are available to students as soon as they are saved."
      />
      <form action={action} className="space-y-4 p-5">
        <StateAlert state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Add to" htmlFor="tax-kind">
            <Select
              id="tax-kind"
              name="kind"
              value={current}
              onChange={(event) => setCurrent(event.target.value as Kind)}
            >
              {KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          {current === "department" && (
            <Field
              label="Code"
              htmlFor="tax-code"
              hint="Short prefix shown on cards, e.g. CS."
            >
              <Input id="tax-code" name="code" placeholder="CS" maxLength={12} />
            </Field>
          )}

          {current === "technology" && (
            <Field label="Technology type" htmlFor="tax-tech-kind">
              <Select id="tax-tech-kind" name="technologyKind" defaultValue="framework">
                {TECHNOLOGY_KINDS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {current === "academic_year" && (
            <>
              <Field
                label="Start year"
                htmlFor="tax-start"
                error={errors.startYear}
                hint="Leave blank if the label already reads “2024–2025”."
              >
                <Input
                  id="tax-start"
                  name="startYear"
                  type="number"
                  inputMode="numeric"
                  placeholder="2024"
                  invalid={Boolean(errors.startYear)}
                />
              </Field>
              <Field label="End year" htmlFor="tax-end">
                <Input
                  id="tax-end"
                  name="endYear"
                  type="number"
                  inputMode="numeric"
                  placeholder="2025"
                />
              </Field>
            </>
          )}

          <Field
            label="Name"
            htmlFor="tax-name"
            required
            error={errors.name}
            hint={
              current === "academic_year"
                ? "Shown as the label, e.g. 2024–2025."
                : current === "semester"
                  ? "e.g. Fall 2025"
                  : "The URL slug is generated from this."
            }
            className={current === "department" || current === "technology" ? "sm:col-span-1" : undefined}
          >
            <Input
              id="tax-name"
              name="name"
              required
              defaultValue={state.values?.name ?? ""}
              invalid={Boolean(errors.name)}
              placeholder={
                current === "department"
                  ? "Computer Science"
                  : current === "technology"
                    ? "Next.js"
                    : current === "academic_year"
                      ? "2024–2025"
                      : current === "semester"
                        ? "Fall 2025"
                        : "Web applications"
              }
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <SubmitButton pendingLabel="Adding…" variant="primary">
            Add entry
          </SubmitButton>
        </div>
      </form>
    </Panel>
  );
}

function RenameRow({ row, kind }: { row: TaxonomyRow; kind: Kind }) {
  const [state, action] = useActionState<AdminActionState, FormData>(
    renameTaxonomyItemAction,
    {},
  );
  const [open, setOpen] = useState(false);
  const errors = state.fieldErrors ?? {};
  const error = errors.name ?? state.error;

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="default" onClick={() => setOpen(true)}>
          Rename
        </Button>
        {state.info && (
          <span className="text-xs text-gh-success" role="status">
            {state.info}
          </span>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="w-full space-y-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={row.id} />
      {error && (
        <Alert tone="danger">{error}</Alert>
      )}
      <Field
        label={`Rename “${row.name}”`}
        htmlFor={`tax-rename-${row.id}`}
        error={errors.name}
        hint="The URL slug is kept so existing links keep working."
      >
        <Input
          id={`tax-rename-${row.id}`}
          name="name"
          defaultValue={row.name}
          required
          invalid={Boolean(errors.name)}
        />
      </Field>
      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…">Save name</SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ActiveToggle({ row, kind }: { row: TaxonomyRow; kind: Kind }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    toggleTaxonomyActiveAction,
    {},
  );
  const next = !row.active;

  return (
    <form action={action}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={row.id} />
      <Button
        type="submit"
        size="sm"
        variant={next ? "default" : "ghost"}
        disabled={pending}
        title={next ? `Make ${row.name} selectable again` : `Hide ${row.name} from new submissions`}
      >
        {pending ? "…" : next ? "Activate" : "Deactivate"}
      </Button>
      {state.error && (
        <span className="ml-2 text-xs text-gh-danger" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}

function DeleteControl({ row, kind }: { row: TaxonomyRow; kind: Kind }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    deleteTaxonomyItemAction,
    {},
  );
  const [confirming, setConfirming] = useState(false);
  const blocked = row.usageCount > 0;

  if (state.info) {
    return (
      <span className="text-xs text-gh-success" role="status">
        {state.info}
      </span>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        if (!confirming) {
          event.preventDefault();
          setConfirming(true);
        }
      }}
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={row.id} />
      {state.error && (
        <span className="w-full text-xs text-gh-danger" role="alert">
          {state.error}
        </span>
      )}
      <Button
        type="submit"
        size="sm"
        variant="danger"
        disabled={pending}
        title={
          blocked
            ? `${row.usageCount} ${usageNoun(kind, row.usageCount)} still reference this entry`
            : `Delete ${row.name}`
        }
      >
        {confirming ? (pending ? "Deleting…" : "Confirm delete") : "Delete"}
      </Button>
      {confirming && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      )}
      {blocked && !confirming && (
        <span className="text-[11px] text-gh-fg-muted">
          {row.usageCount} {usageNoun(kind, row.usageCount)}
        </span>
      )}
    </form>
  );
}

/** One panel per taxonomy list: create, rename, activate and delete in place. */
export function TaxonomyManager({
  kind,
  items,
}: {
  kind: Kind;
  items: TaxonomyRow[];
}) {
  const supportsActive = kind !== "academic_year" && kind !== "semester";
  const activeCount = items.filter((item) => item.active !== false).length;

  return (
    <div className="space-y-6">
      <CreateForm kind={kind} />

      <Panel padded={false}>
        <PanelHeader
          title={KINDS.find((option) => option.value === kind)?.label ?? kind}
          description={`${items.length} ${items.length === 1 ? "entry" : "entries"}${
            supportsActive ? ` · ${activeCount} active` : ""
          }. Deletes are blocked while something still uses an entry.`}
        />
        {items.length === 0 ? (
          <div className="p-5">
            <p className="text-sm text-gh-fg-muted">
              Nothing here yet — add the first entry above.
            </p>
          </div>
          ) : (
          <ul className="divide-y divide-gh-border">
            {items.map((row) => (
              <li key={row.id} className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gh-fg-default">
                      {row.name}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-gh-fg-subtle">
                      {row.slug}
                      {row.meta ? ` · ${row.meta}` : ""}
                    </p>
                  </div>

                  {supportsActive && (
                    <Badge tone={row.active === false ? "muted" : "success"} dot>
                      {row.active === false ? "Inactive" : "Active"}
                    </Badge>
                  )}

                  <Badge tone={row.usageCount > 0 ? "accent" : "muted"}>
                    {row.usageCount} {usageNoun(kind, row.usageCount)}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-64 flex-1">
                    <RenameRow row={row} kind={kind} />
                  </div>
                  {supportsActive && (
                    <ActiveToggle row={row} kind={kind} />
                  )}
                  <DeleteControl row={row} kind={kind} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
