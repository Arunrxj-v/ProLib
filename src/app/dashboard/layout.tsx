import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { Avatar } from "@/components/ui/Avatar";
import { requireUser } from "@/lib/auth/guards";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const user = await requireUser("/dashboard");

  return (
    <div className="w-full">
      <section className="border-b border-gh-border-muted bg-gh-inset">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={user.name} src={user.avatarUrl} size="lg" />
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-gh-fg-muted">
                  {user.role === "admin" ? "Moderator console" : "Student dashboard"}
                </p>
                <h1 className="text-xl font-semibold text-gh-fg-default sm:text-2xl">
                  Welcome, {user.name}
                </h1>
              </div>
            </div>

            <DashboardNav />
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">{children}</div>
    </div>
  );
}
