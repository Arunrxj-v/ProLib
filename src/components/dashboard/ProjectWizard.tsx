"use client";

import { useState, useActionState } from "react";

import { createProjectAction } from "@/actions/projects";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Alert } from "@/components/ui/Panel";
import { PROJECT_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { TechnologyPicker } from "./TechnologyPicker";
import { GithubRepoPicker } from "./GithubRepoPicker";

type TechOption = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  kind: string;
};

type Props = {
  technologies: TechOption[];
};

const SUMMARY_LIMIT = 500;

/**
 * The 2-minute project form. Required: name, a one-or-two-sentence summary,
 * a project type, technologies and a cover image — everything else (long
 * write-up, department, screenshots, team, docs) is optional and lives on the
 * edit screen. Works without JavaScript as a plain multipart form.
 */
export function ProjectWizard({ technologies }: Props) {
  const [state, formAction, pending] = useActionState(createProjectAction, {});
  const [summary, setSummary] = useState("");
  const [coverName, setCoverName] = useState("");
  const [techIds, setTechIds] = useState<string[]>([]);
  const [githubUrl, setGithubUrl] = useState("");

  const fieldErrors = state.fieldErrors ?? {};
  const errorFor = (key: string) => fieldErrors[key];
  const summaryLength = summary.length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gh-fg-default sm:text-3xl">
          Add your project
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gh-fg-muted">
          Name it, describe it in a line or two, pick the stack and drop in a
          cover. Two minutes — the write-up, screenshots and team can follow.
        </p>
      </div>

      {state.error && (
        <Alert tone="danger" className="mb-6" title="Could not create the project">
          {state.error}
        </Alert>
      )}

      <form
        action={formAction}
        encType="multipart/form-data"
        className="space-y-8"
      >
        {/* ---------------- Basics ---------------- */}
        <section className="rounded-lg border border-gh-border bg-gh-surface p-5 sm:p-6">
          <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-gh-fg-muted">
            The essentials
          </h2>

          <div className="space-y-4">
            <Field
              label="Project name"
              htmlFor="w-title"
              required
              error={errorFor("title")}
            >
              <Input
                id="w-title"
                name="title"
                required
                maxLength={120}
                autoFocus
                invalid={Boolean(errorFor("title"))}
                placeholder="e.g. Campus bus tracker"
              />
            </Field>

            <Field
              label="Short description"
              htmlFor="w-short"
              required
              error={errorFor("shortDescription")}
              hint={`${summaryLength}/${SUMMARY_LIMIT} characters — one or two sentences. What does it do, for whom?`}
            >
              <Textarea
                id="w-short"
                name="shortDescription"
                rows={3}
                required
                maxLength={SUMMARY_LIMIT}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                invalid={Boolean(errorFor("shortDescription"))}
                placeholder="A timetable app that tells first-years which bus to take, built during the 2026 hackathon."
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Project type"
                htmlFor="w-type"
                required
                error={errorFor("projectType")}
              >
                <Select
                  id="w-type"
                  name="projectType"
                  required
                  defaultValue=""
                  invalid={Boolean(errorFor("projectType"))}
                >
                  <option value="" disabled>
                    Choose a type…
                  </option>
                  {PROJECT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              {/* Lifecycle starts as in-progress; editable on the edit page. */}
              <input type="hidden" name="status" value="in_progress" />
            </div>
          </div>
        </section>

        {/* ---------------- Cover ---------------- */}
        <section className="rounded-lg border border-gh-border bg-gh-surface p-5 sm:p-6">
          <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-gh-fg-muted">
            Cover image
          </h2>

          <Field
            label="Cover"
            htmlFor="w-cover"
            required
            error={errorFor("cover")}
            hint="JPG, PNG, WebP or AVIF · up to 4 MB. A screenshot of the app works best."
          >
            <div className="flex items-center gap-3">
              <label
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-md border border-gh-border bg-gh-btn px-3.5 py-2 text-xs font-semibold text-gh-fg-default transition-colors hover:bg-gh-btn-hover",
                  errorFor("cover") && "border-gh-danger",
                )}
              >
                <Icon name="upload_file" size={16} />
                Choose image
                <input
                  id="w-cover"
                  name="cover"
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="sr-only"
                  onChange={(event) =>
                    setCoverName(event.target.files?.[0]?.name ?? "")
                  }
                />
              </label>
              <span className="truncate text-xs text-gh-fg-muted">
                {coverName || "No image chosen"}
              </span>
            </div>
          </Field>
        </section>

        {/* ---------------- Stack ---------------- */}
        <section className="rounded-lg border border-gh-border bg-gh-surface p-5 sm:p-6">
          <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-gh-fg-muted">
            Stack
          </h2>

          <TechnologyPicker
            options={technologies}
            selected={techIds}
            onChange={setTechIds}
            error={errorFor("technologyNames") ?? errorFor("technologies")}
          />
        </section>

        {/* ---------------- Links ---------------- */}
        <section className="rounded-lg border border-gh-border bg-gh-surface p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-gh-fg-muted">
              Links
            </h2>
            <span className="font-mono text-[11px] text-gh-fg-subtle">
              optional
            </span>
          </div>

          <div className="space-y-5">
            <GithubRepoPicker value={githubUrl} onChange={setGithubUrl} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Repository URL"
                htmlFor="w-github"
                error={errorFor("githubUrl")}
                hint="Fallback — paste any https://github.com/…/… link instead of connecting."
              >
                <Input
                  id="w-github"
                  name="githubUrl"
                  type="url"
                  inputMode="url"
                  value={githubUrl}
                  onChange={(event) => setGithubUrl(event.target.value)}
                  invalid={Boolean(errorFor("githubUrl"))}
                  placeholder="https://github.com/you/repo"
                />
              </Field>

              <Field
                label="Live demo"
                htmlFor="w-demo"
                error={errorFor("demoUrl")}
              >
                <Input
                  id="w-demo"
                  name="demoUrl"
                  type="url"
                  inputMode="url"
                  invalid={Boolean(errorFor("demoUrl"))}
                  placeholder="https://…"
                />
              </Field>
            </div>
          </div>
        </section>

        {/* ---------------- Footer ---------------- */}
        <div className="flex flex-col gap-3 border-t border-gh-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-gh-fg-muted">
            Team members, screenshots and the long write-up go on the next
            screen.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              name="intent"
              value="draft"
              variant="default"
              disabled={pending}
              leadingIcon={pending ? "progress_activity" : "save"}
            >
              {pending ? "Saving…" : "Save draft"}
            </Button>
            <Button
              type="submit"
              name="intent"
              value="publish"
              variant="primary"
              disabled={pending}
              leadingIcon={pending ? "progress_activity" : "publish"}
            >
              {pending ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
