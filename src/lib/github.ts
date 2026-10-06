import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { githubAccounts, githubRepositories } from "@/lib/db/schema";

/**
 * GitHub integration boundary.
 *
 * Everything that talks to GitHub lives here, and it stays honest about what
 * it knows:
 *
 *   1. OAuth only activates when GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET are
 *      present — `githubOAuthConfig()` returns null and callers surface a
 *      real "not configured" state instead of faking a connection.
 *   2. Tokens and client secrets are never logged, never put in a URL and
 *      never returned to the browser.
 *   3. Public repository metadata is fetched unauthenticated through the
 *      Next data cache (1h) so we stay inside GitHub's 60 req/hr anonymous
 *      budget, and a failure always comes back as an explicit
 *      `{ available: false, reason }` — never a throw, never invented data.
 */

const GITHUB_API = "https://api.github.com";
const AUTHORIZE_ENDPOINT = "https://github.com/login/oauth/authorize";
const TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";

/** Single-use OAuth state cookie; bound to one browser + one user. */
export const GITHUB_STATE_COOKIE = "prolib_gh_state";
/** Seconds the state cookie lives — 10 minutes. */
export const GITHUB_STATE_MAX_AGE = 600;

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export type GithubFailureReason =
  | "not_configured"
  | "exchange_failed"
  | "unauthorized"
  | "rate_limited"
  | "unreachable";

/** Typed failure — messages are static strings and never carry a token. */
export class GithubError extends Error {
  readonly reason: GithubFailureReason;
  /** HTTP status from GitHub, when one was received. */
  readonly status?: number;

  constructor(reason: GithubFailureReason, message: string, status?: number) {
    super(message);
    this.name = "GithubError";
    this.reason = reason;
    this.status = status;
  }
}

function reasonForStatus(status: number): GithubFailureReason {
  if (status === 401) return "unauthorized";
  if (status === 403 || status === 429) return "rate_limited";
  return "unreachable";
}

/* ------------------------------------------------------------------ */
/* OAuth configuration                                                 */
/* ------------------------------------------------------------------ */

export function githubOAuthConfig(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function githubOAuthUrl(state: string, redirectUri: string): string {
  const config = githubOAuthConfig();
  if (!config) throw new GithubError("not_configured", "GitHub OAuth is not configured.");

  const clientId = encodeURIComponent(config.clientId);
  const redirect = encodeURIComponent(redirectUri);
  const nonce = encodeURIComponent(state);
  return (
    `${AUTHORIZE_ENDPOINT}?client_id=${clientId}` +
    `&redirect_uri=${redirect}&scope=read:user%20repo&state=${nonce}`
  );
}

/**
 * The state cookie packs the random nonce together with the user it was
 * issued to, so the callback can prove both "same browser" and "same user".
 */
export function packGithubState(userId: string, state: string): string {
  return `${state}|${userId}`;
}

export function unpackGithubState(
  value: string | undefined | null,
): { userId: string; state: string } | null {
  if (!value) return null;
  const separator = value.indexOf("|");
  if (separator <= 0 || separator === value.length - 1) return null;
  return { state: value.slice(0, separator), userId: value.slice(separator + 1) };
}

/* ------------------------------------------------------------------ */
/* Authenticated calls                                                 */
/* ------------------------------------------------------------------ */

function apiHeaders(token?: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    // GitHub rejects requests without an explicit User-Agent.
    "User-Agent": "ProLib",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Exchanges the one-time authorization code for an access token.
 * The token and the client secret are never written to any log.
 */
export async function exchangeGithubCode(
  code: string,
  redirectUri: string,
): Promise<string> {
  const config = githubOAuthConfig();
  if (!config) throw new GithubError("not_configured", "GitHub OAuth is not configured.");

  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "User-Agent": "ProLib",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
      cache: "no-store",
    });
  } catch {
    throw new GithubError("unreachable", "GitHub could not be reached.");
  }

  const payload = (await response.json().catch(() => null)) as {
    access_token?: unknown;
  } | null;

  const token = typeof payload?.access_token === "string" ? payload.access_token : null;
  if (!response.ok || !token) {
    // GitHub answers 200 + {error: ...} for expired/denied codes; the body
    // holds no token here, but nothing from this exchange is ever logged.
    throw new GithubError(
      "exchange_failed",
      "GitHub did not accept the authorization code.",
      response.status,
    );
  }

  return token;
}

const githubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullish().transform((value) => value ?? null),
  avatar_url: z.string(),
  html_url: z.string(),
});

export type GithubUser = z.infer<typeof githubUserSchema>;

/** GET https://api.github.com/user — the real identity behind the token. */
export async function fetchGithubUser(token: string): Promise<GithubUser> {
  let response: Response;
  try {
    response = await fetch(`${GITHUB_API}/user`, {
      headers: apiHeaders(token),
      cache: "no-store",
    });
  } catch {
    throw new GithubError("unreachable", "GitHub could not be reached.");
  }

  if (!response.ok) {
    throw new GithubError(
      reasonForStatus(response.status),
      "GitHub rejected the stored token.",
      response.status,
    );
  }

  const payload = await response.json().catch(() => null);
  const parsed = githubUserSchema.safeParse(payload);
  if (!parsed.success) {
    throw new GithubError("unreachable", "GitHub returned an unexpected user payload.");
  }
  return parsed.data;
}

const repoItemSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  html_url: z.string(),
  description: z.string().nullish().transform((value) => value ?? null),
  language: z.string().nullish().transform((value) => value ?? null),
  stargazers_count: z.number(),
  fork: z.boolean(),
  private: z.boolean(),
  updated_at: z.string().nullish().transform((value) => value ?? null),
});

/** The only fields the UI ever sees — everything else GitHub sends is dropped. */
export type GithubRepoItem = z.infer<typeof repoItemSchema>;

async function getJson(url: string, token: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { headers: apiHeaders(token), cache: "no-store" });
  } catch {
    throw new GithubError("unreachable", "GitHub could not be reached.");
  }

  if (!response.ok) {
    throw new GithubError(
      reasonForStatus(response.status),
      "GitHub could not list repositories.",
      response.status,
    );
  }

  return response.json().catch(() => null);
}

/**
 * The signed-in student's repositories, newest activity first.
 *
 * With a search query the list is narrowed through the search API scoped to
 * the stored login (`q=user:LOGIN <query>`); without one it is the plain
 * `/user/repos` feed. Either way the result is normalised to
 * {@link GithubRepoItem} — no tokens, no URLs we did not ask for.
 */
export async function listGithubRepos(
  token: string,
  query?: string,
  login?: string,
): Promise<GithubRepoItem[]> {
  const trimmed = query?.trim() ?? "";
  let payload: unknown;

  if (!trimmed) {
    const params = new URLSearchParams({
      per_page: "50",
      sort: "updated",
      affiliation: "owner,collaborator,organization_member",
    });
    payload = await getJson(`${GITHUB_API}/user/repos?${params}`, token);
  } else {
    // Resolve the owner from the stored account; fall back to the token's
    // own identity when the caller has no hint.
    const owner = login ?? (await fetchGithubUser(token)).login;
    const params = new URLSearchParams({
      q: `user:${owner} ${trimmed}`,
      per_page: "50",
    });
    const result = await getJson(
      `${GITHUB_API}/search/repositories?${params}`,
      token,
    );
    const items = (result as { items?: unknown } | null)?.items;
    payload = Array.isArray(items) ? items : [];
  }

  if (!Array.isArray(payload)) {
    throw new GithubError("unreachable", "GitHub returned an unexpected repository list.");
  }

  const parsed = z.array(repoItemSchema).safeParse(payload);
  if (!parsed.success) {
    throw new GithubError("unreachable", "GitHub returned an unexpected repository list.");
  }
  return parsed.data;
}

/* ------------------------------------------------------------------ */
/* Public repository metadata (unauthenticated)                        */
/* ------------------------------------------------------------------ */

export type PublicRepoUnavailableReason = "not_found" | "rate_limited" | "unreachable";

export type PublicRepoMeta =
  | {
      available: true;
      fullName: string;
      htmlUrl: string;
      description: string | null;
      language: string | null;
      stargazersCount: number;
      forksCount: number;
      topics: string[];
      languages: Record<string, number>;
      pushedAt: string | null;
    }
  | { available: false; reason: PublicRepoUnavailableReason };

const publicRepoSchema = z.object({
  full_name: z.string(),
  html_url: z.string(),
  description: z.string().nullish().transform((value) => value ?? null),
  language: z.string().nullish().transform((value) => value ?? null),
  stargazers_count: z.number(),
  forks_count: z.number(),
  topics: z.array(z.string()).default([]),
  pushed_at: z.string().nullish().transform((value) => value ?? null),
});

function unavailableReasonFor(status: number): PublicRepoUnavailableReason {
  if (status === 404) return "not_found";
  if (status === 403 || status === 429) return "rate_limited";
  return "unreachable";
}

/**
 * Real stars / forks / languages for a PUBLIC repository, fetched without a
 * token through the 1-hour data cache (GitHub allows 60 anonymous requests
 * per hour per IP, so every unique repo costs at most 2 of them).
 *
 * This function never throws: an answer GitHub cannot give comes back as
 * `{ available: false, reason }` so pages can render an honest
 * "repository data unavailable" state instead of zeros that look real.
 */
export async function fetchPublicRepoMeta(
  owner: string,
  name: string,
): Promise<PublicRepoMeta> {
  try {
    const repoResponse = await fetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
      { headers: apiHeaders(), next: { revalidate: 3600 } },
    );
    if (!repoResponse.ok) {
      return { available: false, reason: unavailableReasonFor(repoResponse.status) };
    }

    const repoPayload = await repoResponse.json().catch(() => null);
    const repo = publicRepoSchema.safeParse(repoPayload);
    if (!repo.success) {
      return { available: false, reason: "unreachable" };
    }

    const languagesResponse = await fetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/languages`,
      { headers: apiHeaders(), next: { revalidate: 3600 } },
    );
    if (!languagesResponse.ok) {
      return { available: false, reason: unavailableReasonFor(languagesResponse.status) };
    }

    const languagesPayload = await languagesResponse.json().catch(() => null);
    const languages = z
      .record(z.string(), z.number())
      .safeParse(languagesPayload ?? {});
    if (!languages.success) {
      return { available: false, reason: "unreachable" };
    }

    return {
      available: true,
      fullName: repo.data.full_name,
      htmlUrl: repo.data.html_url,
      description: repo.data.description,
      language: repo.data.language,
      stargazersCount: repo.data.stargazers_count,
      forksCount: repo.data.forks_count,
      topics: repo.data.topics,
      languages: languages.data,
      pushedAt: repo.data.pushed_at,
    };
  } catch {
    return { available: false, reason: "unreachable" };
  }
}

/* ------------------------------------------------------------------ */
/* Repository URL parsing                                              */
/* ------------------------------------------------------------------ */

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const REPO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

function parseRepoSegments(value: string): { owner: string; repo: string } | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") return null;

  const segments = url.pathname.split("/").filter((part) => part !== "");
  if (segments.length !== 2) return null;

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, "");
  if (!OWNER_PATTERN.test(owner)) return null;
  if (!REPO_PATTERN.test(repo) || repo === "." || repo === "..") return null;

  return { owner, repo };
}

const githubRepoUrlSchema = z
  .string()
  .trim()
  .max(300, "That link is too long.")
  .refine((value) => parseRepoSegments(value) !== null, {
    message: "Paste a repository link like https://github.com/owner/repo.",
  });

/**
 * Validates `https://github.com/{owner}/{repo}` — accepts `.git` and a
 * trailing slash, rejects every non-github.com host and any deeper path.
 */
export function parseGithubRepoUrl(
  url: string | null | undefined,
): { owner: string; repo: string } | null {
  if (!url) return null;
  const parsed = githubRepoUrlSchema.safeParse(url);
  if (!parsed.success) return null;
  return parseRepoSegments(parsed.data);
}

/* ------------------------------------------------------------------ */
/* Stored account accessors (never expose the token)                   */
/* ------------------------------------------------------------------ */

export type GithubIdentity = {
  login: string;
  avatarUrl: string | null;
  htmlUrl: string | null;
  connectedAt: Date;
};

/** Safe profile shape for the UI — selects display columns only. */
export async function getGithubIdentity(
  userId: string,
): Promise<GithubIdentity | null> {
  const rows = await db
    .select({
      login: githubAccounts.login,
      avatarUrl: githubAccounts.avatarUrl,
      htmlUrl: githubAccounts.htmlUrl,
      connectedAt: githubAccounts.createdAt,
    })
    .from(githubAccounts)
    .where(eq(githubAccounts.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    login: row.login,
    avatarUrl: row.avatarUrl,
    htmlUrl: row.htmlUrl,
    connectedAt: row.connectedAt,
  };
}

/**
 * Server-side credentials for the repository picker. Returns null when the
 * student has never connected GitHub (or the stored token is empty).
 */
export async function getGithubAccount(
  userId: string,
): Promise<{ login: string; accessToken: string } | null> {
  const rows = await db
    .select({
      login: githubAccounts.login,
      accessToken: githubAccounts.accessToken,
    })
    .from(githubAccounts)
    .where(eq(githubAccounts.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row?.accessToken) return null;
  return { login: row.login, accessToken: row.accessToken };
}

/**
 * Links (or re-links) the GitHub identity to an EXISTING ProLib user.
 * Never touches the `users` table — no account is ever created from
 * GitHub data. Throws on a unique-constraint conflict when the same
 * GitHub account is already linked to a different user.
 */
export async function upsertGithubAccount(
  userId: string,
  profile: GithubUser,
  accessToken: string,
): Promise<void> {
  await db
    .insert(githubAccounts)
    .values({
      userId,
      githubId: profile.id,
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatar_url,
      htmlUrl: profile.html_url,
      accessToken,
    })
    .onConflictDoUpdate({
      target: githubAccounts.userId,
      set: {
        githubId: profile.id,
        login: profile.login,
        name: profile.name,
        avatarUrl: profile.avatar_url,
        htmlUrl: profile.html_url,
        accessToken,
        updatedAt: new Date(),
      },
    });
}

/**
 * Turns a pasted/picked repository URL into a stored association row
 * (§23) and returns its id — or null when the URL isn't a GitHub repo.
 *
 * GitHub remains the source of truth: the row only caches what we already
 * know (owner/name/url) plus a light metadata snapshot refreshed on demand.
 * Works with or without OAuth — a manual URL is a real association too.
 * Never throws: if the public API is unreachable at this moment the row is
 * still created with `fetchedAt: null` so nothing is ever invented.
 */
export async function associateGithubRepository(
  url: string | null | undefined,
  linkedByUserId?: string,
): Promise<string | null> {
  const parsed = parseGithubRepoUrl(url);
  if (!parsed) return null;

  const fullName = `${parsed.owner}/${parsed.repo}`;
  const existing = await db
    .select({ id: githubRepositories.id })
    .from(githubRepositories)
    .where(eq(githubRepositories.fullName, fullName))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const meta = await fetchPublicRepoMeta(parsed.owner, parsed.repo);
  const id = crypto.randomUUID();

  await db
    .insert(githubRepositories)
    .values({
      id,
      linkedByUserId: linkedByUserId ?? null,
      owner: parsed.owner,
      name: parsed.repo,
      fullName,
      htmlUrl: meta.available ? meta.htmlUrl : `https://github.com/${fullName}`,
      description: meta.available ? meta.description : null,
      stargazersCount: meta.available ? meta.stargazersCount : 0,
      forksCount: meta.available ? meta.forksCount : 0,
      language: meta.available ? meta.language : null,
      fetchedAt: meta.available ? new Date() : null,
    })
    .onConflictDoNothing({ target: githubRepositories.fullName });

  // Re-read so a concurrent insert of the same repo still yields its row.
  const rows = await db
    .select({ id: githubRepositories.id })
    .from(githubRepositories)
    .where(eq(githubRepositories.fullName, fullName))
    .limit(1);
  return rows[0]?.id ?? null;
}
