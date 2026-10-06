"use server";

/**
 * Public report submission for `/report/[slug]`.
 *
 * Reachable by anonymous visitors, so the action is deliberately defensive:
 * it re-resolves the project with the *same* visibility rule as the public
 * project page (a hidden project must look exactly like a missing one), never
 * trusts the reason list from the client, de-duplicates identical open reports
 * and applies a coarse per-reporter rate limit.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { getReportableProject } from "@/lib/data/reporting";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import { isReportReason } from "@/lib/reporting";

export type ReportActionState = {
  error?: string;
  info?: string;
  fieldErrors?: Record<string, string>;
  /** Values to repopulate after a failed submit. */
  values?: Record<string, string>;
};

const DETAILS_MAX = 1000;
const OPEN_LIMIT_SIGNED_IN = 5;
const OPEN_LIMIT_ANONYMOUS = 5;

const reportSchema = z.object({
  slug: z.string().trim().min(1, "That project could not be read."),
  reason: z
    .string()
    .trim()
    .refine(isReportReason, "Choose why you are reporting this project."),
  details: z
    .string()
    .trim()
    .max(DETAILS_MAX, `Keep the description under ${DETAILS_MAX} characters.`),
});

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function submitReportAction(
  _prev: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const slug = text(formData, "slug").trim();
  const reason = text(formData, "reason").trim();
  const details = text(formData, "details").trim();

  const parsed = reportSchema.safeParse({ slug, reason, details });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors, values: { reason, details } };
  }

  const user = await getCurrentUser();

  // Same visibility rule as the project page: anything the viewer may not see
  // is reported back identically to a project that simply does not exist.
  const project = await getReportableProject(parsed.data.slug);
  if (!project) {
    return {
      error: "That project is not available to report right now.",
      values: { reason, details },
    };
  }

  const identity = user
    ? eq(reports.reporterId, user.id)
    : isNull(reports.reporterId);

  // 1) An identical open report from the same person is a duplicate, not a
  //    second signal — this doubles as the anonymous rate limit.
  const duplicates = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.projectId, project.id),
        eq(reports.reason, parsed.data.reason),
        eq(reports.status, "open"),
        identity,
        sql`COALESCE(${reports.details}, '') = ${parsed.data.details}`,
      ),
    )
    .limit(1);

  if (duplicates.length > 0) {
    return {
      info: "Thanks — a report just like this is already open for this project.",
      values: {},
    };
  }

  // 2) Coarse rate limit: no account may keep flooding the open queue.
  const since = new Date(Date.now() - (user ? 3_600_000 : 600_000));
  const windowRows = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(reports)
    .where(
      and(
        eq(reports.status, "open"),
        user ? eq(reports.reporterId, user.id) : isNull(reports.reporterId),
        sql`${reports.createdAt} >= ${Math.floor(since.getTime() / 1000)}`,
      ),
    );

  const openInWindow = Number(windowRows[0]?.value ?? 0);
  if (openInWindow >= (user ? OPEN_LIMIT_SIGNED_IN : OPEN_LIMIT_ANONYMOUS)) {
    return {
      error: "That is enough new reports for the moment — the moderators will catch up on the ones already sent.",
      values: { reason, details },
    };
  }

  await db.insert(reports).values({
    id: crypto.randomUUID(),
    projectId: project.id,
    reporterId: user?.id ?? null,
    reason: parsed.data.reason,
    details: parsed.data.details || null,
    status: "open",
  });

  revalidatePath("/admin/reports");
  revalidatePath("/admin");

  return {
    info: "Thanks — your report is with the moderators. They review every open report.",
    values: {},
  };
}
