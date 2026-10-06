import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TaxonomyManager } from "@/components/admin/TaxonomyManager";
import { LinkButton } from "@/components/ui/Button";
import { TabLinks } from "@/components/ui/Navigation";
import { requireAdmin } from "@/lib/auth/guards";
import {
  TAXONOMY_KINDS,
  isTaxonomyKind,
  listTaxonomy,
  taxonomyTitle,
} from "@/lib/data/admin";
import { first } from "@/lib/data/filters";

export const metadata: Metadata = {
  title: "Taxonomy",
  description: "Departments, categories, technologies and terms used across the library.",
};

export default async function AdminTaxonomyPage({
  searchParams,
}: PageProps<"/admin/taxonomy">) {
  await requireAdmin();

  const params = await searchParams;
  const raw = first(params.kind);
  const kind = raw && isTaxonomyKind(raw) ? raw : TAXONOMY_KINDS[0];

  const items = await listTaxonomy(kind);

  const tabs = TAXONOMY_KINDS.map((value) => ({
    value,
    label: taxonomyTitle(value),
    href: value === TAXONOMY_KINDS[0] ? "/admin/taxonomy" : `/admin/taxonomy?kind=${value}`,
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Moderation"
        title="Taxonomy"
        description="The controlled vocabularies behind filters and project metadata. Entries that are still in use cannot be deleted — reassign the projects first, or deactivate the entry to hide it from new submissions."
        action={
          <LinkButton href="/admin/students" variant="ghost" leadingIcon="group">
            Students
          </LinkButton>
        }
      />

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabLinks tabs={tabs} active={kind} label="Choose a taxonomy list" />
      </div>

      <TaxonomyManager kind={kind} items={items} />
    </div>
  );
}
