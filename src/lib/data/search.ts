import { asc, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { technologies } from "@/lib/db/schema";

import { likeMatch } from "./internal";
import { listProjects, type ProjectCardData } from "./projects";
import { listStudents, type StudentCardData } from "./students";

export type TechnologyHit = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  projectCount: number;
};

export type SearchResults = {
  query: string;
  projects: ProjectCardData[];
  projectTotal: number;
  students: StudentCardData[];
  studentTotal: number;
  technologies: TechnologyHit[];
  total: number;
};

/** Technology matches only — exported for the /search results page. */
export async function searchTechnologies(query: string, limit: number) {
  const condition = likeMatch([sql`${technologies.name}`], query);
  if (!condition) return { items: [] as TechnologyHit[], total: 0 };

  const projectCount = sql<number>`(
    SELECT COUNT(*) FROM project_technologies pt
      JOIN projects p ON p.id = pt.project_id
     WHERE pt.technology_id = ${technologies}.id
       AND p.publication_status IN ('approved', 'published')
  )`.as("project_count");

  const rows = await db
    .select({
      id: technologies.id,
      name: technologies.name,
      slug: technologies.slug,
      icon: technologies.icon,
      projectCount,
    })
    .from(technologies)
    .where(sql`${condition} AND ${technologies}.active IS TRUE`)
    .orderBy(sql`project_count DESC`, asc(technologies.name))
    .limit(limit);

  return { items: rows, total: rows.length };
}

/**
 * One query set behind the header search box: projects, students and
 * technologies. Everything is served from the database — nothing is filtered
 * from a hardcoded client-side list.
 */
export async function searchAll(query: string, limit = 5): Promise<SearchResults> {
  const trimmed = query.trim();

  if (!trimmed) {
    return {
      query: "",
      projects: [],
      projectTotal: 0,
      students: [],
      studentTotal: 0,
      technologies: [],
      total: 0,
    };
  }

  const [projectResult, studentResult, technologyResult] = await Promise.all([
    listProjects({ q: trimmed, pageSize: limit }),
    listStudents({ q: trimmed, pageSize: limit }),
    searchTechnologies(trimmed, limit),
  ]);

  return {
    query: trimmed,
    projects: projectResult.items,
    projectTotal: projectResult.total,
    students: studentResult.items,
    studentTotal: studentResult.total,
    technologies: technologyResult.items,
    total: projectResult.total + studentResult.total + technologyResult.total,
  };
}

/** Exposed for the /api/search route. */
export async function searchPreview(query: string) {
  const results = await searchAll(query, 4);
  return {
    query: results.query,
    total: results.total,
    groups: [
      {
        key: "projects",
        label: "Projects",
        href: `/explore?q=${encodeURIComponent(results.query)}`,
        items: results.projects.map((project) => ({
          title: project.title,
          subtitle: project.shortDescription,
          href: `/projects/${project.slug}`,
        })),
      },
      {
        key: "students",
        label: "Students",
        href: `/students?q=${encodeURIComponent(results.query)}`,
        items: results.students.map((student) => ({
          title: student.name,
          subtitle: student.headline ?? student.username ?? "",
          href: student.username ? `/students/${student.username}` : "/students",
        })),
      },
      {
        key: "technologies",
        label: "Technologies",
        href: `/technologies?q=${encodeURIComponent(results.query)}`,
        items: results.technologies.map((technology) => ({
          title: technology.name,
          subtitle: `${technology.projectCount} projects`,
          href: `/explore?technology=${technology.slug}`,
        })),
      },
    ].filter((group) => group.items.length > 0),
  };
}
