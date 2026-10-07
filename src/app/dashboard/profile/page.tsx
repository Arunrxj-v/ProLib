import type { Metadata } from "next";
import Link from "next/link";

import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { Avatar } from "@/components/ui/Avatar";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Alert, Panel, PanelHeader } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Tag";
import { requireUser } from "@/lib/auth/guards";
import { getMySocials, getProfileChecks } from "@/lib/data/myProjects";
import { getDepartments } from "@/lib/data/taxonomy";
import { getGithubIdentity, githubOAuthConfig } from "@/lib/github";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My profile",
  description: "Update the public profile other students and reviewers see.",
};

/** Honest explanations for every failure reason the OAuth callback can emit. */
const GITHUB_FLASH_ERRORS: Record<string, string> = {
  state: "The sign-in window expired — try connecting again.",
  denied: "You cancelled the GitHub authorization — nothing was changed.",
  not_configured: "GitHub OAuth is not configured on this instance.",
  exchange_failed: "GitHub did not accept the sign-in — try again in a moment.",
  unauthorized: "GitHub could not verify that account.",
  rate_limited: "GitHub's API rate limit was reached — try again in a few minutes.",
  unreachable: "GitHub could not be reached right now.",
  account_taken:
    "That GitHub account is already linked to a different ProLib user.",
};

export default async function ProfilePage({
  searchParams,
}: PageProps<"/dashboard/profile">) {
  const params = await searchParams;
  const user = await requireUser("/dashboard/profile");

  const [socials, departments, profile] = await Promise.all([
    getMySocials(user.id),
    getDepartments(),
    getProfileChecks(user.id),
  ]);

  const githubConfigured = githubOAuthConfig() !== null;
  const githubIdentity = await getGithubIdentity(user.id);
  const githubError =
    params.github === "error"
      ? GITHUB_FLASH_ERRORS[String(params.reason)] ??
        "Something went wrong while connecting GitHub."
      : null;

  const completion = Math.round((profile.complete / profile.total) * 100);

  return (
    <div className="w-full py-8 sm:py-10">
      <header className="mb-6 flex flex-col gap-4 border-b border-gh-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} src={user.avatarUrl} size="xl" />
          <div>
            <Eyebrow>Public profile</Eyebrow>
            <h1 className="text-2xl font-bold tracking-tight text-gh-fg-default">
              {user.name}
            </h1>
            <p className="mt-1 font-mono text-xs text-gh-fg-muted">
              {user.username ? `@${user.username}` : "handle not set"} · {user.email}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {user.username && (
            <LinkButton
              href={`/students/${user.username}`}
              variant="ghost"
              leadingIcon="open_in_new"
            >
              View public page
            </LinkButton>
          )}
          <LinkButton href="/dashboard/projects" variant="default" leadingIcon="folder">
            My projects
          </LinkButton>
        </div>
      </header>

      {params.saved === "1" && (
        <Alert tone="success" className="mb-6">
          Profile saved.
        </Alert>
      )}
      {params.github === "connected" && (
        <Alert tone="success" className="mb-6" title="GitHub connected">
          {githubIdentity
            ? `ProLib is linked to @${githubIdentity.login} — you can pick repositories directly from the project form.`
            : "Your GitHub identity is linked."}
        </Alert>
      )}
      {githubError && (
        <Alert tone="danger" className="mb-6" title="GitHub connection failed">
          {githubError}
        </Alert>
      )}
      {!user.username && (
        <Alert tone="attention" className="mb-6" title="Pick a handle">
          Your public profile needs a handle before it can be shared.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ProfileForm
          user={{
            name: user.name,
            username: user.username,
            email: user.email,
            avatarUrl: user.avatarUrl,
            headline: user.headline,
            bio: user.bio,
            departmentId: user.departmentId,
            batch: user.batch,
            skills: user.skills,
            githubUsername: user.githubUsername,
            portfolioUrl: user.portfolioUrl,
            location: user.location,
          }}
          departments={departments.map((item) => ({ id: item.id, name: item.name }))}
          socials={socials}
        />

        <aside className="space-y-6">
          <Panel padded={false}>
            <PanelHeader
              title="Completeness"
              description={`${profile.complete} of ${profile.total} steps`}
            />
            <div className="p-5">
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-gh-inset"
                role="progressbar"
                aria-valuenow={completion}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Profile completeness"
              >
                <div
                  className="h-full rounded-full bg-gh-success"
                  style={{ width: `${completion}%` }}
                />
              </div>

              <ul className="mt-4 space-y-2">
                {profile.checks.map((check) => (
                  <li key={check.label} className="flex items-start gap-2 text-xs">
                    <Icon
                      name={check.done ? "check_circle" : "radio_button_unchecked"}
                      size={15}
                      tone={check.done ? "success" : "muted"}
                      className="mt-px shrink-0"
                    />
                    <span className={check.done ? "text-gh-fg-muted" : "text-gh-fg-default"}>
                      {check.label}
                    </span>
                    {!check.done && (
                      <Link
                        href={check.href}
                        className="ml-auto shrink-0 text-gh-accent hover:underline"
                      >
                        Fix
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel padded={false}>
            <PanelHeader
              title="GitHub"
              description={
                githubIdentity
                  ? `Connected as @${githubIdentity.login}`
                  : githubConfigured
                    ? "Not connected"
                    : "Not configured in this environment"
              }
            />
            <div className="space-y-3 p-5">
              {githubIdentity ? (
                <>
                  <p className="text-xs leading-relaxed text-gh-fg-muted">
                    Linked {formatDate(githubIdentity.connectedAt)}. ProLib
                    uses it to list your repositories while you create a
                    project — the token never leaves the server.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={
                        githubIdentity.htmlUrl ?? "https://github.com"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-gh-border bg-gh-btn px-3 py-2 text-xs font-medium text-gh-fg-default transition-colors hover:bg-gh-btn-hover"
                    >
                      <Icon name="code" size={16} tone="accent" />
                      Open GitHub
                    </a>
                    <a
                      href="/api/github/connect"
                      className="inline-flex items-center gap-1.5 rounded-md border border-gh-border bg-gh-inset px-3 py-2 text-xs font-medium text-gh-fg-muted transition-colors hover:text-gh-fg-default"
                    >
                      <Icon name="sync" size={16} />
                      Reconnect
                    </a>
                  </div>
                </>
              ) : githubConfigured ? (
                <>
                  <p className="text-xs leading-relaxed text-gh-fg-muted">
                    Connect to choose a repository directly from the project
                    form. Only your public identity (name, handle, avatar) is
                    stored.
                  </p>
                  <a
                    href="/api/github/connect"
                    className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(240,246,252,0.1)] bg-gh-btn-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-gh-btn-primary-hover"
                  >
                    <Icon name="code" size={16} />
                    Connect GitHub
                  </a>
                </>
              ) : (
                <div className="rounded-md border border-gh-border bg-gh-inset p-3 text-xs leading-relaxed text-gh-fg-muted">
                  <p className="font-medium text-gh-fg-default">
                    GitHub OAuth is not configured on this instance.
                  </p>
                  <p className="mt-1">
                    Set <code className="text-gh-accent">GITHUB_CLIENT_ID</code>,{" "}
                    <code className="text-gh-accent">GITHUB_CLIENT_SECRET</code>{" "}
                    and{" "}
                    <code className="text-gh-accent">GITHUB_CALLBACK_URL</code>{" "}
                    in <code className="text-gh-accent">.env.local</code> (see{" "}
                    <code className="text-gh-accent">.env.example</code>) and
                    restart the dev server. Until then you can still paste a
                    repository URL on any project.
                  </p>
                </div>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
