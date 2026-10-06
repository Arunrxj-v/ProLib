"use client";

import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Form";

type Status = {
  configured: boolean;
  signedIn: boolean;
  connected: boolean;
  /** Only present once connected — display identity, never the token. */
  identity?: { login: string } | null;
};

type RepoItem = {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
  private: boolean;
};

type ListState = "idle" | "stale" | "rateLimited" | "error";

/**
 * "Connect GitHub → list your real repositories → pick one" with an honest
 * fallback at every step:
 *
 * - OAuth not configured  → says so, the manual URL field below still works.
 * - Not connected         → "Connect GitHub to select a repository."
 * - Connected             → live search over the student's actual repos.
 * - Token revoked / limit → explicit message, never a fake list.
 *
 * Connecting opens in a new tab so the half-filled project form is not lost;
 * status re-checks when the window regains focus.
 */
export function GithubRepoPicker({
  value,
  onChange,
}: {
  /** Current repository URL — when a real repo is selected, the picker
   *  shows the ✓ state from §22 instead of silently filling a text box. */
  value?: string;
  onChange: (url: string) => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [listState, setListState] = useState<ListState>("idle");

  const selectedMatch = value?.match(
    /^https:\/\/github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/,
  );
  const selected = selectedMatch ? selectedMatch[1] + "/" + selectedMatch[2] : null;

  const checkStatus = useCallback(() => {
    fetch("/api/github/status")
      .then((response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        return response.json();
      })
      .then((data) => {
        setStatusFailed(false);
        setStatus({
          configured: Boolean(data.configured),
          signedIn: Boolean(data.signedIn),
          connected: Boolean(data.connected),
        });
      })
      .catch(() => setStatusFailed(true));
  }, []);

  useEffect(() => {
    checkStatus();
    const onFocus = () => checkStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [checkStatus]);

  useEffect(() => {
    if (!status?.connected) return;
    const controller = new AbortController();
    const term = query.trim();

    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/github/repos?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = await response.json().catch(() => null);
          if (!response.ok || !data) {
            setRepos([]);
            setListState("error");
            return;
          }
          setRepos(Array.isArray(data.items) ? data.items : []);
          setListState(
            data.stale
              ? "stale"
              : data.rateLimited
                ? "rateLimited"
                : "idle",
          );
        })
        .catch(() => {
          if (!controller.signal.aborted) setListState("error");
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, status?.connected]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs font-medium text-gh-fg-muted">
          Pick from your repositories
        </p>
        {status?.connected && status.configured && (
          <span className="inline-flex items-center gap-1 rounded-full border border-gh-border bg-gh-inset px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gh-fg-muted">
            <Icon name="check_circle" size={11} tone="success" />
            {status.identity?.login
              ? `GitHub connected as @${status.identity.login}`
              : "GitHub connected"}
          </span>
        )}
      </div>

      {selected && (
        <p className="flex items-center gap-2 rounded-md border border-gh-border bg-gh-inset px-3 py-2 font-mono text-xs text-gh-fg-default">
          <Icon name="check_circle" size={13} tone="success" />
          {selected}
        </p>
      )}

      {statusFailed ? (
        <p className="rounded-md border border-gh-border bg-gh-inset px-3 py-2.5 text-xs leading-relaxed text-gh-danger">
          Unable to connect to ProLib server.
        </p>
      ) : !status ? (
        <p className="text-xs text-gh-fg-muted">Checking GitHub connection…</p>
      ) : !status.configured ? (
        <p className="rounded-md border border-gh-border bg-gh-inset px-3 py-2.5 text-xs leading-relaxed text-gh-fg-muted">
          GitHub OAuth isn&apos;t configured in this environment. Set{" "}
          <code className="text-gh-accent">GITHUB_CLIENT_ID</code>,{" "}
          <code className="text-gh-accent">GITHUB_CLIENT_SECRET</code> and{" "}
          <code className="text-gh-accent">GITHUB_CALLBACK_URL</code> in{" "}
          <code className="text-gh-accent">.env.local</code> (see{" "}
          <code className="text-gh-accent">.env.example</code>) and reload —
          Connect GitHub appears here automatically.
        </p>
      ) : !status.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gh-border bg-gh-inset px-3 py-2.5">
          <p className="text-xs text-gh-fg-muted">
            Connect GitHub to select a repository.
          </p>
          <a
            href="/api/github/connect"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(240,246,252,0.1)] bg-gh-btn-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gh-btn-primary-hover"
          >
            <Icon name="code" size={14} />
            Connect GitHub
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your repositories…"
            aria-label="Search your GitHub repositories"
          />

          {searching ? (
            <p className="text-xs text-gh-fg-muted">Loading repositories…</p>
          ) : listState === "stale" ? (
            <p className="text-xs text-gh-danger">
              Your GitHub token no longer works — reconnect from your profile
              page, then come back.
            </p>
          ) : listState === "rateLimited" ? (
            <p className="text-xs text-gh-fg-muted">
              GitHub&apos;s API rate limit was reached — try again in a few
              minutes, or paste the URL below.
            </p>
          ) : listState === "error" ? (
            <p className="text-xs text-gh-danger">
              Could not load your repositories — paste the URL below instead.
            </p>
          ) : repos.length === 0 ? (
            <p className="text-xs text-gh-fg-muted">
              {query.trim()
                ? `No repository matches “${query.trim()}”.`
                : "No repositories found on this account."}
            </p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-gh-border bg-gh-inset p-2">
              {repos.map((repo) => (
                <li key={repo.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(repo.html_url);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left transition-colors hover:bg-gh-btn-hover"
                  >
                    <Icon name="fork" size={15} tone="accent" className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-gh-fg-default">
                        {repo.full_name}
                        {repo.private && (
                          <span className="ml-2 rounded border border-gh-border px-1 font-mono text-[10px] text-gh-fg-muted">
                            private
                          </span>
                        )}
                      </span>
                      {repo.description && (
                        <span className="block truncate text-[11px] text-gh-fg-muted">
                          {repo.description}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-gh-fg-subtle">
                      {repo.language && <span>{repo.language}</span>}
                      {repo.stargazers_count > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Icon name="star" size={11} />
                          {repo.stargazers_count}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
