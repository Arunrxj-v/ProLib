import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StudentRowActions } from "@/components/admin/StudentRowActions";
import { Avatar } from "@/components/ui/Avatar";
import { Button, LinkButton } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Pagination, TabLinks } from "@/components/ui/Navigation";
import { EmptyState } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Tag";
import { requireAdmin } from "@/lib/auth/guards";
import { listAdminStudents } from "@/lib/data/admin";
import { first, flattenParams } from "@/lib/data/filters";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Students",
  description: "Every account on the platform, with roles, status and activity.",
};

const ROLE_TABS = [
  { value: "all", label: "Everyone" },
  { value: "student", label: "Students" },
  { value: "admin", label: "Admins" },
];

const STATUS_TABS = [
  { value: "all", label: "Any status" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

export default async function AdminStudentsPage({
  searchParams,
}: PageProps<"/admin/students">) {
  const admin = await requireAdmin();

  const params = await searchParams;
  const q = first(params.q);
  const rawRole = first(params.role);
  const rawStatus = first(params.status);
  const role =
    rawRole === "student" || rawRole === "admin" ? rawRole : "all";
  const status =
    rawStatus === "active" || rawStatus === "suspended" ? rawStatus : "all";
  const page = Number(first(params.page) ?? "1");

  const result = await listAdminStudents({
    q,
    role: role as "all" | "student" | "admin",
    status: status as "all" | "active" | "suspended",
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
    pageSize: 12,
  });

  const flat = flattenParams(params);

  const hrefWith = (overrides: Record<string, string>): string => {
    const search = new URLSearchParams();
    const merged = { role, status, q: q ?? "", ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== "all" && !(key === "q" && value === "")) {
        search.set(key, value);
      }
    }
    const query = search.toString();
    return query ? `/admin/students?${query}` : "/admin/students";
  };

  const roleTabs = ROLE_TABS.map((tab) => ({
    ...tab,
    href: hrefWith({ role: tab.value }),
  }));
  const statusTabs = STATUS_TABS.map((tab) => ({
    ...tab,
    href: hrefWith({ status: tab.value }),
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Directory"
        title="Students & accounts"
        description="Everything the platform knows about each account. Suspension removes sign-in access immediately; roles decide who can reach this console."
        action={
          <LinkButton href="/admin/taxonomy" variant="ghost" leadingIcon="category">
            Manage departments
          </LinkButton>
        }
      />

      <div className="space-y-4">
        <form method="get" action="/admin/students">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              name="q"
              aria-label="Search accounts"
              defaultValue={q ?? ""}
              placeholder="Search by name, handle or email…"
              className="sm:max-w-md flex-1"
            />
            <Button type="submit" variant="default" leadingIcon="search">
              Search
            </Button>
            {q && (
              <Link
                href={hrefWith({ q: "" })}
                className="text-xs font-medium text-gh-fg-muted hover:text-gh-accent"
              >
                Clear search
              </Link>
            )}
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="status" value={status} />
          </div>
        </form>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-gh-fg-muted">
              Role
            </span>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <TabLinks tabs={roleTabs} active={role} label="Filter by role" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-gh-fg-muted">
              Status
            </span>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <TabLinks
                tabs={statusTabs}
                active={status}
                label="Filter by status"
              />
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-gh-fg-muted">
        <span className="font-semibold text-gh-fg-default">{result.total}</span>{" "}
        {result.total === 1 ? "account" : "accounts"}
        {q && (
          <>
            {" "}
            matching <span className="font-mono text-gh-accent">“{q}”</span>
          </>
        )}
      </p>

      {result.items.length > 0 ? (
        <ul className="space-y-3">
          {result.items.map((student) => (
            <li key={student.id}>
              <article className="rounded-lg border border-gh-border bg-gh-card p-4 transition-colors hover:border-gh-fg-subtle sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <Avatar name={student.name} src={student.avatarUrl} size="lg" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {student.username ? (
                          <Link
                            href={`/students/${student.username}`}
                            className="text-sm font-semibold text-gh-fg-default hover:text-gh-accent"
                          >
                            {student.name}
                          </Link>
                        ) : (
                          <span className="text-sm font-semibold text-gh-fg-default">
                            {student.name}
                          </span>
                        )}
                        <Badge tone={student.role === "admin" ? "accent" : "muted"}>
                          {student.role === "admin" ? "Administrator" : "Student"}
                        </Badge>
                        <Badge tone={student.status === "active" ? "success" : "danger"} dot>
                          {student.status}
                        </Badge>
                        {student.featured && <Badge tone="attention">Featured</Badge>}
                        {!student.emailVerifiedAt && (
                          <Badge tone="attention">Email unverified</Badge>
                        )}
                        {student.id === admin.id && (
                          <Badge tone="muted">This is you</Badge>
                        )}
                      </div>

                      <p className="mt-1 break-all font-mono text-[11px] text-gh-fg-muted">
                        {student.email}
                        {student.username && ` · @${student.username}`}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-gh-fg-muted">
                        <span className="flex items-center gap-1.5">
                          <Icon name="corporate_fare" size={13} />
                          {student.department?.name ?? "No department"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Icon name="folder_open" size={13} />
                          {student.projectCount} project
                          {student.projectCount === 1 ? "" : "s"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Icon name="event" size={13} />
                          Joined {formatDate(student.createdAt)}
                        </span>
                        {student.emailVerifiedAt && (
                          <span className="flex items-center gap-1.5 text-gh-success">
                            <Icon name="verified" size={13} tone="success" />
                            Verified {formatDate(student.emailVerifiedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <StudentRowActions
                      student={{
                        id: student.id,
                        name: student.name,
                        role: student.role,
                        status: student.status,
                        featured: student.featured,
                        emailVerified: Boolean(student.emailVerifiedAt),
                      }}
                      isSelf={student.id === admin.id}
                    />
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="person_search"
          title="No accounts match"
          description={
            q
              ? `Nothing matches “${q}” with these filters.`
              : "No account has this combination of role and status."
          }
          action={
            <LinkButton href="/admin/students" variant="default">
              Show everyone
            </LinkButton>
          }
        />
      )}

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        basePath="/admin/students"
        searchParams={flat}
      />
    </div>
  );
}
