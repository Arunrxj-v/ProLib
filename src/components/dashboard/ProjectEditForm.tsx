"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import { updateProjectAction } from "@/actions/projects";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Alert, Panel, PanelHeader } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Tag";
import { withBase } from "@/lib/base-path";
import type { MyProjectDetail } from "@/lib/data/myProjects";
import { PROJECT_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { TechnologyPicker } from "./TechnologyPicker";
import { GithubRepoPicker } from "./GithubRepoPicker";

type Option = { id: string; name: string };
type TechOption = { id: string; name: string; slug: string; icon: string | null; kind: string };

type Props = {
  detail: MyProjectDetail;
  departments: Option[];
  categories: Option[];
  years: Option[];
  semesters: Option[];
  technologies: TechOption[];
  sectionValues: Record<string, string>;
};

const SECTION_LABELS: Record<string, string> = {
  overview: "Overview",
  problem: "Problem",
  solution: "Solution",
  features: "Features",
  technology: "Technology",
  architecture: "Architecture",
  challenges: "Challenges",
  future: "Future improvements",
};

const SECTION_HINTS: Record<string, string> = {
  overview: "What the project does, in a paragraph.",
  problem: "The campus or real-world problem it tackles.",
  solution: "Your approach and the decisions behind it.",
  features: "What actually works today.",
  technology: "Frameworks, models and hardware — and why.",
  architecture: "Layout, services and data flow: enough to reproduce it.",
  challenges: "What broke and how you fixed it.",
  future: "The next steps you would take.",
};

export function ProjectEditForm({
  detail,
  departments,
  categories,
  years,
  semesters,
  technologies,
  sectionValues,
}: Props) {
  const { project } = detail;
  const [state, formAction, pending] = useActionState(updateProjectAction, {});
  const [selectedTech, setSelectedTech] = useState<string[]>(
    detail.technologies.map((item) => item.id),
  );
  const [githubUrl, setGithubUrl] = useState(project.githubUrl ?? "");

  const errorFor = (key: string) => state.fieldErrors?.[key];
  const sectionKeys = Object.keys(SECTION_LABELS);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="projectId" value={project.id} />

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.info && <Alert tone="success">{state.info}</Alert>}

      {/* Basics */}
      <Panel padded={false}>
        <PanelHeader title="Basics" description="How the project is described everywhere." />
        <div className="space-y-5 p-5">
          <Field label="Title" htmlFor="edit-title" required error={errorFor("title")}>
            <Input
              id="edit-title"
              name="title"
              required
              maxLength={120}
              defaultValue={project.title}
              invalid={Boolean(errorFor("title"))}
            />
          </Field>

          <Field
            label="One-line summary"
            htmlFor="edit-short"
            required
            error={errorFor("shortDescription")}
            hint="20–280 characters — this is what cards and search results show."
          >
            <Textarea
              id="edit-short"
              name="shortDescription"
              required
              maxLength={280}
              rows={2}
              defaultValue={project.shortDescription}
              invalid={Boolean(errorFor("shortDescription"))}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project type" htmlFor="edit-type" required error={errorFor("projectType")}>
              <Select
                id="edit-type"
                name="projectType"
                defaultValue={project.projectType}
              >
                {PROJECT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Lifecycle" htmlFor="edit-status" required error={errorFor("status")}>
              <Select id="edit-status" name="status" defaultValue={project.status}>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>

            <Field label="Department" htmlFor="edit-department" error={errorFor("departmentId")}>
              <Select
                id="edit-department"
                name="departmentId"
                defaultValue={project.departmentId ?? ""}
                invalid={Boolean(errorFor("departmentId"))}
              >
                <option value="">Not department-specific</option>
                {departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Category" htmlFor="edit-category" error={errorFor("categoryId")}>
              <Select
                id="edit-category"
                name="categoryId"
                defaultValue={project.categoryId ?? ""}
              >
                <option value="">Choose a category</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Academic year" htmlFor="edit-year" error={errorFor("academicYearId")}>
              <Select
                id="edit-year"
                name="academicYearId"
                defaultValue={project.academicYearId ?? ""}
              >
                <option value="">Not tied to a year</option>
                {years.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Semester" htmlFor="edit-semester" error={errorFor("semesterId")}>
              <Select
                id="edit-semester"
                name="semesterId"
                defaultValue={project.semesterId ?? ""}
              >
                <option value="">Not tied to a semester</option>
                {semesters.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </Panel>

      {/* Write-up */}
      <Panel padded={false}>
        <PanelHeader
          title="Write-up"
          description="Rendered as sections on the public project page. Leave a section empty to hide it."
        />
        <div className="space-y-5 p-5">
          <Field
            label="Long-form write-up (markdown)"
            htmlFor="edit-description"
            error={errorFor("description")}
          >
            <Textarea
              id="edit-description"
              name="description"
              rows={8}
              defaultValue={project.description ?? ""}
              invalid={Boolean(errorFor("description"))}
              placeholder="Optional — anything you want above the sections."
            />
          </Field>

          <div className="grid gap-4">
            {sectionKeys.map((key) => (
              <Field
                key={key}
                label={SECTION_LABELS[key]}
                htmlFor={`edit-section-${key}`}
                hint={SECTION_HINTS[key]}
              >
                <Textarea
                  id={`edit-section-${key}`}
                  name={`section_${key}`}
                  rows={4}
                  defaultValue={sectionValues[key] ?? ""}
                />
              </Field>
            ))}
          </div>
        </div>
      </Panel>

      {/* Stack & links */}
      <Panel padded={false}>
        <PanelHeader
          title="Stack & links"
          description="Only links you fill in are shown publicly."
        />
        <div className="space-y-5 p-5">
          <TechnologyPicker
            options={technologies}
            selected={selectedTech}
            onChange={setSelectedTech}
          />

          <GithubRepoPicker value={githubUrl} onChange={setGithubUrl} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Repository URL"
              htmlFor="edit-github"
              error={errorFor("githubUrl")}
              hint="Fallback — paste any https://github.com/…/… link instead of connecting."
            >
              <Input
                id="edit-github"
                name="githubUrl"
                type="url"
                value={githubUrl}
                onChange={(event) => setGithubUrl(event.target.value)}
                invalid={Boolean(errorFor("githubUrl"))}
                placeholder="https://github.com/…"
              />
            </Field>
            <Field label="Live demo" htmlFor="edit-demo" error={errorFor("demoUrl")}>
              <Input
                id="edit-demo"
                name="demoUrl"
                type="url"
                defaultValue={project.demoUrl ?? ""}
                invalid={Boolean(errorFor("demoUrl"))}
                placeholder="https://…"
              />
            </Field>
            <Field label="Documentation" htmlFor="edit-docs" error={errorFor("docsUrl")}>
              <Input
                id="edit-docs"
                name="docsUrl"
                type="url"
                defaultValue={project.docsUrl ?? ""}
                invalid={Boolean(errorFor("docsUrl"))}
                placeholder="https://…"
              />
            </Field>
            <Field label="Walkthrough video" htmlFor="edit-video" error={errorFor("videoUrl")}>
              <Input
                id="edit-video"
                name="videoUrl"
                type="url"
                defaultValue={project.videoUrl ?? ""}
                invalid={Boolean(errorFor("videoUrl"))}
                placeholder="https://…"
              />
            </Field>
          </div>
        </div>
      </Panel>

      {/* Cover */}
      <Panel padded={false}>
        <PanelHeader title="Cover image" description="JPG, PNG, WebP or AVIF · max 4 MB." />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-md border border-gh-border bg-gh-inset sm:w-56">
            {project.coverImage ? (
              <Image
                src={withBase(project.coverImage)}
                alt=""
                fill
                sizes="224px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full flex-col items-center justify-center gap-1 text-gh-fg-subtle">
                <Icon name="image" size={22} />
                <span className="font-mono text-[11px]">No cover yet</span>
              </span>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <Field label="Replace cover" htmlFor="edit-cover">
              <input
                id="edit-cover"
                name="cover"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="block w-full text-xs text-gh-fg-muted file:mr-3 file:rounded file:border file:border-gh-border file:bg-gh-btn-bg file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gh-fg-default hover:file:bg-gh-btn-hover"
              />
            </Field>

            {project.coverImage && (
              <Checkbox
                name="removeCover"
                label="Remove the current cover"
                description="The public page falls back to your schematic placeholder."
              />
            )}
          </div>
        </div>
      </Panel>

      {/* Save */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gh-border bg-gh-card p-4",
        )}
      >
        <p className="font-mono text-[11px] text-gh-fg-subtle">
          <Icon name="cloud_done" size={13} className="mr-1 inline align-[-2px]" />
          {pending ? "Saving changes…" : "Drafts save instantly; published URLs stay stable."}
        </p>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={pending}
          leadingIcon={pending ? "progress_activity" : "save"}
        >
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <Eyebrow className="sr-only">End of form</Eyebrow>
    </form>
  );
}
