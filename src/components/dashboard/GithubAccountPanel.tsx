"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { formatDate } from "@/lib/utils";

export type GithubPanelIdentity = {
  login: string;
  htmlUrl: string | null;
  /** ISO string — the panel is a client component, so the server passes text. */
  connectedAt: string;
};

/**
 * The profile's GitHub panel, in every honest state:
 *
 *  - connected        → Connected as @login + Open / Reconnect / Disconnect
 *                       (Disconnect asks for confirmation first and explains
 *                       that repository browsing turns off until reconnected)
 *  - not connected    → "Not connected" + Connect GitHub, with the reason
 *                       (repository selection in the project form)
 *  - not configured   → the real missing-env explanation, never a fake button
 *
 * Disconnect POSTs to /api/github/disconnect (session-scoped server-side),
 * then `router.refresh()` re-renders the server-rendered profile with the
 * new state — no optimistic lies, the UI shows what the database says.
 */
export function GithubAccountPanel({
  configured,
  identity,
}: {
  configured: boolean;
  identity: GithubPanelIdentity | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState(false);

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/github/disconnect", { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(
          payload?.message ?? "GitHub could not be disconnected — try again.",
        );
        return;
      }
      setConfirming(false);
      setDisconnected(true);
      router.refresh();
    } catch {
      setError("GitHub could not be reached — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel padded={false}>
      <PanelHeader
        title="GitHub"
        description={
          identity
            ? `Connected as @${identity.login}`
            : configured
              ? "Not connected"
              : "Not configured in this environment"
        }
      />
      <div className="space-y-3 p-5">
        {error && (
          <p className="rounded-md border border-gh-danger/40 bg-gh-inset px-3 py-2 text-xs leading-relaxed text-gh-danger">
            {error}
          </p>
        )}

        {identity ? (
          <>
            {disconnected && (
              <p className="rounded-md border border-gh-border bg-gh-inset px-3 py-2 text-xs leading-relaxed text-gh-fg-muted">
                GitHub disconnected. Repository browsing is off until you
                connect again — your account, projects and repository links
                are untouched.
              </p>
            )}
            <p className="text-xs leading-relaxed text-gh-fg-muted">
              Linked {formatDate(new Date(identity.connectedAt))}. ProLib uses
              it to list your repositories while you create a project — the
              token never leaves the server.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={identity.htmlUrl ?? "https://github.com"}
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
              {!confirming && (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gh-border bg-gh-inset px-3 py-2 text-xs font-medium text-gh-fg-muted transition-colors hover:text-gh-danger"
                >
                  <Icon name="link_off" size={16} />
                  Disconnect
                </button>
              )}
            </div>

            {confirming && (
              <div
                role="alertdialog"
                aria-label="Confirm GitHub disconnect"
                className="space-y-3 rounded-md border border-gh-border bg-gh-inset p-3"
              >
                <p className="text-xs leading-relaxed text-gh-fg-default">
                  Disconnect @{identity.login}? Repository browsing in the
                  project form is disabled until you connect GitHub again.
                  Your ProLib account, projects, team memberships and saved
                  repository links stay exactly as they are.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={disconnect}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gh-danger/40 bg-gh-inset px-3 py-2 text-xs font-semibold text-gh-danger transition-colors hover:bg-gh-btn-hover disabled:opacity-50"
                  >
                    <Icon
                      name={busy ? "progress_activity" : "link_off"}
                      size={16}
                    />
                    {busy ? "Disconnecting…" : "Yes, disconnect"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gh-border bg-gh-btn px-3 py-2 text-xs font-medium text-gh-fg-muted transition-colors hover:text-gh-fg-default disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : configured ? (
          <>
            <p className="text-xs leading-relaxed text-gh-fg-muted">
              Connect your GitHub account to browse repositories directly from
              the project form when submitting a project. Only your public
              identity (name, handle, avatar) is stored.
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
              <code className="text-gh-accent">GITHUB_CLIENT_SECRET</code> and{" "}
              <code className="text-gh-accent">GITHUB_CALLBACK_URL</code> in{" "}
              <code className="text-gh-accent">.env.local</code> (see{" "}
              <code className="text-gh-accent">.env.example</code>) and restart
              the dev server. Until then you can still paste a repository URL
              on any project.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}
