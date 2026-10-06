import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth/guards";

/**
 * Every `/admin` screen passes through here first: the proxy only checked
 * that a session cookie exists, this checks — against the database — that the
 * signed-in account actually carries the admin role.
 */
export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <div className="w-full">
      <section className="border-b border-gh-border-muted bg-gh-inset">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-gh-accent">
                ProLib · Moderation
              </p>
              <p className="text-lg font-semibold text-gh-fg-default">
                Admin console
              </p>
            </div>

            <AdminNav />
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
