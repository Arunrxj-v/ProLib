"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Overview", href: "/dashboard", exact: true, icon: "grid_view" },
  { label: "My projects", href: "/dashboard/projects", exact: false, icon: "folder_open" },
  { label: "New project", href: "/dashboard/projects/new", exact: true, icon: "add_box" },
  { label: "Profile", href: "/dashboard/profile", exact: true, icon: "person" },
  { label: "Activity", href: "/dashboard/notifications", exact: true, icon: "notifications" },
];

/** Section navigation for the student dashboard — highlights the current route. */
export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard"
      className="flex gap-1 overflow-x-auto pb-0.5"
    >
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        const isAction = link.label === "New project";

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              isAction
                ? "border border-[rgba(63,185,80,0.4)] bg-gh-btn-primary text-white hover:bg-gh-btn-primary-hover"
                : active
                  ? "border border-gh-border bg-gh-btn-bg text-gh-fg-default"
                  : "border border-transparent text-gh-fg-muted hover:bg-gh-btn-hover hover:text-gh-fg-default",
            )}
          >
            <Icon name={link.icon} size={16} tone={isAction ? "inherit" : "default"} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
