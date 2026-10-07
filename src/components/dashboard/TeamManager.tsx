"use client";

import Link from "next/link";
import { useEffect, useActionState, useState } from "react";

import { addMemberAction, removeMemberAction } from "@/actions/projects";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Alert, EmptyState, Panel, PanelHeader } from "@/components/ui/Panel";
import type { StudentSearchHit } from "@/lib/data/students";

type Member = {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  role: string;
  isOwner: boolean;
};

/**
 * Team membership is a real relation: teammates are picked from actual ProLib
 * accounts (searched by name, confirmed by handle) — never typed in as free
 * text, never faked.
 */
export function TeamManager({
  projectId,
  members,
}: {
  projectId: string;
  members: Member[];
  currentUser: string;
}) {
  const [addState, addAction, addPending] = useActionState(addMemberAction, {});
  const [removeState, removeAction, removePending] = useActionState(
    removeMemberAction,
    {},
  );

  const [query, setQuery] = useState("");
  const [username, setUsername] = useState("");
  const [suggestions, setSuggestions] = useState<StudentSearchHit[]>([]);
  const [directoryCount, setDirectoryCount] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);

  /**
   * Debounced directory lookup (results land in async callbacks, never
   * synchronously in the effect). An empty query just seeds the directory
   * count so the UI can say "no other users yet" honestly instead of
   * guessing.
   */
  useEffect(() => {
    const term = query.trim();
    const controller = new AbortController();

    if (!term) {
      fetch("/api/students?q=", { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data && typeof data.directoryCount === "number") {
            setDirectoryCount(data.directoryCount);
          }
        })
        .catch(() => undefined);
      return () => controller.abort();
    }

    const timer = setTimeout(() => {
      fetch(`/api/students?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`status ${response.status}`);
          return response.json();
        })
        .then((data) => {
          setSearchFailed(false);
          setSuggestions(Array.isArray(data.items) ? data.items : []);
          if (typeof data.directoryCount === "number") {
            setDirectoryCount(data.directoryCount);
          }
        })
        .catch((cause) => {
          if ((cause as Error | undefined)?.name !== "AbortError") {
            setSearchFailed(true);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const message = addState.error ?? addState.info ?? removeState.error ?? removeState.info ?? null;
  const failed = Boolean(addState.error ?? removeState.error);
  const term = query.trim();

  return (
    <Panel padded={false}>
      <PanelHeader
        title="Team"
        description={`${members.length} member${members.length === 1 ? "" : "s"} on this project`}
      />

      <div className="space-y-4 p-5">
        <ul className="space-y-3">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center gap-3">
              <Avatar name={member.name} src={member.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gh-fg-default">
                  {member.username ? (
                    <Link
                      href={`/students/${member.username}`}
                      className="hover:text-gh-accent"
                    >
                      {member.name}
                    </Link>
                  ) : (
                    member.name
                  )}
                </p>
                <p className="truncate font-mono text-[11px] text-gh-fg-subtle">
                  {member.role}
                  {member.username ? ` · @${member.username}` : ""}
                </p>
              </div>

              {member.isOwner ? (
                <span className="shrink-0 rounded-full border border-gh-border bg-gh-inset px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gh-fg-muted">
                  Owner
                </span>
              ) : (
                <form action={removeAction}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="userId" value={member.userId} />
                  <button
                    type="submit"
                    disabled={removePending}
                    aria-label={`Remove ${member.name} from the team`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gh-border text-gh-fg-muted transition-colors hover:border-gh-danger hover:text-gh-danger disabled:opacity-50"
                  >
                    <Icon name="person_remove" size={15} />
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        <form action={addAction} className="space-y-3 border-t border-gh-border pt-4">
          <input type="hidden" name="projectId" value={projectId} />

          <Field
            label="Find a teammate"
            htmlFor="member-search"
            hint="Search the ProLib directory by name — or skip ahead and type a handle."
          >
            <Input
              id="member-search"
              type="search"
              value={query}
              onChange={(event) => {
                const next = event.target.value;
                setQuery(next);
                setSearching(Boolean(next.trim()));
                setSearchFailed(false);
                setSuggestions([]);
              }}
              autoComplete="off"
              placeholder="Search students…"
            />
          </Field>

          {term && (
            <div
              className="rounded-md border border-gh-border bg-gh-inset p-2"
              aria-live="polite"
            >
              {searchFailed ? (
                <p className="px-2 py-2 text-xs text-gh-danger">
                  Unable to connect to ProLib server.
                </p>
              ) : searching ? (
                <p className="px-2 py-2 text-xs text-gh-fg-muted">
                  Searching…
                </p>
              ) : suggestions.length > 0 ? (
                <ul className="space-y-1">
                  {suggestions.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setUsername(hit.username ?? "");
                          setQuery("");
                          setSuggestions([]);
                        }}
                        className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left transition-colors hover:bg-gh-btn-hover"
                      >
                        <Avatar name={hit.name} src={hit.avatarUrl} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-gh-fg-default">
                            {hit.name}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-gh-fg-muted">
                            @{hit.username}
                            {hit.headline ? ` · ${hit.headline}` : ""}
                          </span>
                        </span>
                        <Icon name="add" size={14} tone="accent" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 py-2 text-xs text-gh-fg-muted">
                  {directoryCount === 0
                    ? "No other ProLib users yet."
                    : `No students match “${term}”.`}
                </p>
              )}
            </div>
          )}

          {!term && directoryCount === 0 && (
            <p className="text-xs text-gh-fg-subtle">
              No other ProLib users yet — teammates can be added once they
              sign up.
            </p>
          )}

          <Field
            label="Handle"
            htmlFor="member-username"
            error={addState.fieldErrors?.username}
            hint="Their campus profile handle — picked above or typed directly."
          >
            <Input
              id="member-username"
              name="username"
              required
              autoComplete="off"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              invalid={Boolean(addState.fieldErrors?.username)}
              placeholder="handle"
            />
          </Field>

          <Field
            label="Role on this project"
            htmlFor="member-role"
            error={addState.fieldErrors?.role}
          >
            <Input
              id="member-role"
              name="role"
              required
              maxLength={40}
              defaultValue="Developer"
              invalid={Boolean(addState.fieldErrors?.role)}
              placeholder="Developer"
            />
          </Field>

          <Button
            type="submit"
            variant="default"
            size="sm"
            block
            disabled={addPending}
            leadingIcon={addPending ? "progress_activity" : "person_add"}
          >
            {addPending ? "Adding…" : "Add to team"}
          </Button>
        </form>

        {message && (
          <Alert tone={failed ? "danger" : "success"}>{message}</Alert>
        )}
      </div>
    </Panel>
  );
}

/** Shown when a project has no teammates yet — keeps the empty state honest. */
export function TeamEmptyState() {
  return (
    <EmptyState
      icon="group"
      title="No team members added"
      description="Search the ProLib directory for a classmate and add them so credit is shared."
      compact
    />
  );
}
