import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { projects, users } from "@/lib/db/schema";

import { getTechnologies } from "./taxonomy";

/** Headline numbers for the homepage metric bar — always real counts. */
export type LibraryStats = {
  projects: number;
  students: number;
  technologies: number;
  repositories: number;
};

export async function getLibraryStats(): Promise<LibraryStats> {
  const [projectRows, studentRows, repoRows, technologies] = await Promise.all([
    db
      .select({ value: sql<number>`COUNT(*)` })
      .from(projects)
      .where(
        sql`projects.publication_status IN ('approved', 'published')`,
      ),
    db
      .select({ value: sql<number>`COUNT(*)` })
      .from(users)
      .where(sql`users.status = 'active'`),
    db
      .select({ value: sql<number>`COUNT(*)` })
      .from(projects)
      .where(
        sql`projects.publication_status IN ('approved', 'published') AND projects.github_url IS NOT NULL`,
      ),
    getTechnologies(),
  ]);

  return {
    projects: Number(projectRows[0]?.value ?? 0),
    students: Number(studentRows[0]?.value ?? 0),
    technologies: technologies.filter((tech) => tech.projectCount > 0).length,
    repositories: Number(repoRows[0]?.value ?? 0),
  };
}
