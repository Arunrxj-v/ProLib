import Link from "next/link";

import { BrandLink } from "@/components/layout/BrandLogo";
import { Icon } from "@/components/ui/Icon";

const COLUMNS = [
  {
    title: "Discovery",
    links: [
      { label: "Explore Feed", href: "/" },
      { label: "Project Index", href: "/explore" },
      { label: "Project Categories", href: "/categories" },
      { label: "Tech Stacks", href: "/technologies" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Student Directory", href: "/students" },
      { label: "Search Everything", href: "/search" },
      { label: "Submit a Project", href: "/dashboard/projects/new" },
      { label: "Student Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "Public API", href: "/api/projects" },
      { label: "Campus Admin Console", href: "/admin" },
      { label: "Sign in", href: "/login" },
      { label: "Create Account", href: "/signup" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full border-t border-gh-border bg-gh-inset">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <BrandLink />
            <p className="max-w-sm text-xs leading-relaxed text-gh-fg-muted">
              Discover what your college is building. A living library of student
              projects, ideas, and builders across batches.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gh-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gh-success" />
              </span>
              <span className="font-mono text-xs font-medium text-gh-fg-muted">
                All campus services operational
              </span>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title} className="space-y-3">
              <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-gh-fg-default">
                {column.title}
              </h4>
              <ul className="space-y-2 text-xs">
                {column.links.map((link) => (
                  <li key={link.label} className="flex">
                    <Link
                      href={link.href}
                      className="text-gh-fg-muted transition-colors hover:text-gh-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-gh-border pt-8 sm:flex-row">
          <p className="text-xs text-gh-fg-muted">
            © {new Date().getFullYear()} ProLib Campus Engine. Crafted for student
            engineers.
          </p>
          <div className="flex items-center gap-4 text-gh-fg-muted">
            <Link
              href="/explore?sort=trending"
              aria-label="Open source repositories"
              className="transition-colors hover:text-gh-fg-default"
            >
              <Icon name="code" size={18} />
            </Link>
            <Link
              href="/students"
              aria-label="Student community"
              className="transition-colors hover:text-gh-fg-default"
            >
              <Icon name="forum" size={18} />
            </Link>
            <Link
              href="/categories"
              aria-label="Project categories"
              className="transition-colors hover:text-gh-fg-default"
            >
              <Icon name="podcasts" size={18} />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
