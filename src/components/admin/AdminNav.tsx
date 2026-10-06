"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Overview", href: "/admin", exact: true, icon: "space_dashboard" },
  { label: "Review queue", href: "/admin/projects", exact: false, icon: "fact_check" },
  { label: "Students", href: "/admin/students", exact: true, icon: "group" },
  { label: "Reports", href: "/admin/reports", exact: true, icon: "flag" },
  { label: "Taxonomy", href: "/admin/taxonomy", exact: true, icon: "category" },
  { label: "Settings", href: "/admin/settings", exact: true, icon: "settings" },
];

/** Section navigation for the admin console — mirrors the dashboard nav. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin console" className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border border-gh-border bg-gh-btn-bg text-gh-fg-default"
                : "border border-transparent text-gh-fg-muted hover:bg-gh-btn-hover hover:text-gh-fg-default",
            )}
          >
            <Icon name={link.icon} size={16} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
