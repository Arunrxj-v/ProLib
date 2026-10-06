import "server-only";

import { randomBytes } from "node:crypto";

import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";

import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import type { User } from "@/lib/db/schema";

import { hashToken } from "./tokens";

export { hashToken };

export const SESSION_COOKIE = "prolib_session";
const SESSION_TTL_DAYS = 30;
const TOUCH_INTERVAL_MS = 10 * 60 * 1000;

/** The public shape of an authenticated user — password material is stripped. */
export type SessionUser = Omit<User, "passwordHash">;

function stripSecrets(user: User): SessionUser {
  const { passwordHash: _passwordHash, ...safe } = user;
  void _passwordHash;
  return safe;
}

/** Issues a new session row and sets the httpOnly cookie. */
export async function createSession(
  userId: string,
  meta: { userAgent?: string | null } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    lastSeenAt: new Date(),
    userAgent: meta.userAgent?.slice(0, 250) ?? null,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Resolves the signed-in user for the current request.
 * Memoised with React `cache()` so a render only hits the database once.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const now = new Date();

  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.user.status === "suspended") return null;

  // Keep "last seen" reasonably fresh without writing on every request.
  const lastSeen = row.session.lastSeenAt?.getTime() ?? 0;
  if (Date.now() - lastSeen > TOUCH_INTERVAL_MS) {
    await db
      .update(sessions)
      .set({ lastSeenAt: now })
      .where(eq(sessions.id, row.session.id));
  }

  return stripSecrets(row.user);
});

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }

  cookieStore.delete(SESSION_COOKIE);
}

/** Removes expired rows — called opportunistically from the admin dashboard. */
export async function purgeExpiredSessions(): Promise<number> {
  const rows = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning({ id: sessions.id });
  return rows.length;
}
