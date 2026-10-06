/**
 * Project input contracts for the student dashboard.
 *
 * The same schemas validate the create wizard and the edit form, and the
 * server re-validates every submit — the browser is never trusted.
 */

import { z } from "zod";

import {
  LIFECYCLE_STATUSES,
  PROJECT_SECTION_KEYS,
  PROJECT_TYPES,
} from "@/lib/constants";

const MAX_URL = 300;

/** Only absolute http(s) links — never relative, never javascript:. */
const url = z
  .string()
  .trim()
  .max(MAX_URL, "That link is too long.")
  .refine(
    (value) => {
      if (value === "") return true;
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Enter a full http(s) link." },
  );

function oneOf(
  options: ReadonlyArray<{ value: string }>,
  message: string,
  allowEmpty = true,
) {
  return z
    .string()
    .trim()
    .refine(
      (value) =>
        (allowEmpty && value === "") ||
        options.some((option) => option.value === value),
      { message },
    );
}

export const projectBasicsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(4, "Titles need at least 4 characters.")
    .max(120, "Keep the title under 120 characters."),
  shortDescription: z
    .string()
    .trim()
    .min(20, "Summarise the project in at least 20 characters.")
    .max(500, "Keep the summary under 500 characters — one or two sentences."),
  projectType: oneOf(PROJECT_TYPES, "Choose a project type.", false),
  status: oneOf(LIFECYCLE_STATUSES, "Choose a lifecycle status.", false),
  departmentId: z.string().trim().nullish(),
  categoryId: z.string().trim().nullish(),
  academicYearId: z.string().trim().nullish(),
  semesterId: z.string().trim().nullish(),
});

export const projectBodySchema = z.object({
  description: z.string().trim().max(40_000, "Write-up is too long.").nullish(),
  sections: z
    .array(
      z.object({
        key: z.enum(
          PROJECT_SECTION_KEYS.map((item) => item.value) as unknown as [
            string,
            ...string[],
          ],
        ),
        title: z.string().trim().max(120).nullish(),
        content: z.string().trim().max(20_000).nullish(),
        visible: z.boolean().optional(),
      }),
    )
    .max(PROJECT_SECTION_KEYS.length)
    .optional(),
});

export const projectLinksSchema = z.object({
  githubUrl: url.nullish(),
  demoUrl: url.nullish(),
  docsUrl: url.nullish(),
  videoUrl: url.nullish(),
});

export const projectFormSchema = projectBasicsSchema
  .merge(projectBodySchema)
  .merge(projectLinksSchema);

export type ProjectFormInput = z.input<typeof projectFormSchema>;

/**
 * What a submission must contain before it can go live. Deliberately short:
 * the long-form write-up is optional, so publishing never feels like
 * academic paperwork.
 */
export const SUBMIT_REQUIREMENTS = [
  { key: "title", label: "a title" },
  { key: "summary", label: "a short summary" },
] as const;

/* ------------------------------------------------------------------ */
/* Team + taxonomy helpers                                             */
/* ------------------------------------------------------------------ */

export const memberSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Enter a campus handle.")
    .max(30)
    .regex(/^[a-z0-9_]+$/i, "Handles are letters, numbers and underscores."),
  role: z
    .string()
    .trim()
    .min(2, "Describe the teammate's role.")
    .max(40, "Keep the role under 40 characters."),
});

export const technologySchema = z.object({
  technologyId: z.string().trim().min(1, "Pick a technology."),
});

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your name.")
    .max(80, "That name is too long."),
  username: z
    .string()
    .trim()
    .min(3, "Handles need at least 3 characters.")
    .max(30, "Handles can be at most 30 characters.")
    .regex(/^[a-z0-9_]+$/i, "Letters, numbers and underscores only.")
    .transform((value) => value.toLowerCase()),
  headline: z.string().trim().max(120, "Keep the headline under 120 characters.").nullish(),
  bio: z.string().trim().max(800, "Keep the bio under 800 characters.").nullish(),
  departmentId: z.string().trim().nullish(),
  batch: z
    .string()
    .trim()
    .min(1, "Enter your graduation year.")
    .transform((value) => Number(value))
    .refine(
      (value) =>
        Number.isInteger(value) &&
        value >= 2000 &&
        value <= new Date().getFullYear() + 1,
      { message: "Enter a valid graduation year." },
    ),
  skills: z.string().trim().max(300, "That skill list is too long.").nullish(),
  githubUsername: z
    .string()
    .trim()
    .max(39, "GitHub handles are at most 39 characters.")
    .regex(/^$|^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i, "That is not a GitHub handle.")
    .nullish(),
  portfolioUrl: url.nullish(),
  location: z.string().trim().max(80).nullish(),
});

export const socialSchema = z.object({
  provider: z.string().trim().min(1, "Choose a network."),
  url: z
    .string()
    .trim()
    .max(MAX_URL)
    .refine(
      (value) => {
        try {
          const parsed = new URL(value);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "Enter a full http(s) link." },
    ),
});

export type FieldErrors = Record<string, string>;

export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/** `""` → `null` so optional links are stored as SQL NULL, not empty strings. */
export function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
