import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { rawRows } from "@/lib/db/raw";
import {
  academicYears,
  semesters,
  technologies,
} from "@/lib/db/schema";

import { getPublicStatuses } from "./projects";

/** Renders a parameterised `(?, ?, ?)` list for a publication-status filter. */
function statusList(statuses: string[]) {
  return sql.join(
    statuses.map((status) => sql`${status}`),
    sql`, `,
  );
}

/* ------------------------------------------------------------------ */
/* Departments (fully configurable by admins)                          */
/* ------------------------------------------------------------------ */

type DepartmentRow = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  description: string | null;
  project_count: number;
};

export type DepartmentOption = Omit<DepartmentRow, "project_count"> & { projectCount: number };

export async function getDepartments(): Promise<DepartmentOption[]> {
  const statuses = await getPublicStatuses();

  const rows = await rawRows<DepartmentRow>(sql`
    SELECT d.id, d.name, d.slug, d.code, d.description,
      (SELECT COUNT(*) FROM projects p
        WHERE p.department_id = d.id
          AND p.publication_status IN (${statusList(statuses)})) AS project_count
    FROM departments d
    WHERE d.active IS TRUE
    ORDER BY d.position ASC, LOWER(d.name) ASC
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    code: row.code,
    description: row.description,
    projectCount: Number(row.project_count),
  }));
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  tone: string;
  project_count: number;
};

export type CategoryOption = Omit<CategoryRow, "project_count"> & { projectCount: number };

export async function getCategories(): Promise<CategoryOption[]> {
  const statuses = await getPublicStatuses();

  const rows = await rawRows<CategoryRow>(sql`
    SELECT c.id, c.name, c.slug, c.description, c.icon, c.tone,
      (SELECT COUNT(*) FROM projects p
        WHERE p.category_id = c.id
          AND p.publication_status IN (${statusList(statuses)})) AS project_count
    FROM categories c
    WHERE c.active IS TRUE
    ORDER BY c.position ASC, LOWER(c.name) ASC
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    tone: row.tone,
    projectCount: Number(row.project_count),
  }));
}

/* ------------------------------------------------------------------ */
/* Technologies (data-driven, never hardcoded)                         */
/* ------------------------------------------------------------------ */

type TechnologyRow = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  kind: string;
  project_count: number;
};

export type TechnologyOption = Omit<TechnologyRow, "project_count"> & { projectCount: number };

export async function getTechnologies(): Promise<TechnologyOption[]> {
  const statuses = await getPublicStatuses();

  const rows = await rawRows<TechnologyRow>(sql`
    SELECT t.id, t.name, t.slug, t.icon, t.kind,
      (SELECT COUNT(*) FROM project_technologies pt
         JOIN projects p ON p.id = pt.project_id
        WHERE pt.technology_id = t.id
          AND p.publication_status IN (${statusList(statuses)})) AS project_count
    FROM technologies t
    WHERE t.active IS TRUE
    ORDER BY project_count DESC, LOWER(t.name) ASC
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    kind: row.kind,
    projectCount: Number(row.project_count),
  }));
}

/** Lightweight list for the create-project picker (no counts needed). */
export async function getTechnologyOptions() {
  return db
    .select({
      id: technologies.id,
      name: technologies.name,
      slug: technologies.slug,
      icon: technologies.icon,
      kind: technologies.kind,
    })
    .from(technologies)
    .where(eq(technologies.active, true))
    .orderBy(asc(technologies.name));
}

/* ------------------------------------------------------------------ */
/* Academic calendar                                                   */
/* ------------------------------------------------------------------ */

export async function getAcademicYears() {
  return db
    .select()
    .from(academicYears)
    .orderBy(asc(academicYears.position), asc(academicYears.startYear));
}

export async function getSemesters() {
  return db.select().from(semesters).orderBy(asc(semesters.position));
}
