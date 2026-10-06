import type { Metadata } from "next";

import { ProjectWizard } from "@/components/dashboard/ProjectWizard";
import { requireUser } from "@/lib/auth/guards";
import { getTechnologyOptions } from "@/lib/data/taxonomy";

export const metadata: Metadata = {
  title: "New project",
  description: "Add a project to the library in about two minutes.",
};

export default async function NewProjectPage() {
  await requireUser("/dashboard/projects/new");

  const technologies = await getTechnologyOptions();

  return (
    <ProjectWizard
      technologies={technologies.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        icon: item.icon,
        kind: item.kind,
      }))}
    />
  );
}
