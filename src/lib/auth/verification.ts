import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { verificationTokens } from "@/lib/db/schema";

import { generateToken, hashToken } from "./tokens";

const TOKEN_TTL_HOURS = 24;
/** Minimum wait between two verification emails to the same account. */
const RESEND_COOLDOWN_SECONDS = 60;
/** Hard cap: at most this many verification emails per account per hour. */
const RESEND_HOURLY_CAP = 4;

/**
 * Creates a single-use college-email verification token (§6): 256 bits of
 * CSPRNG entropy, stored only as an HMAC digest, expiring in 24 hours.
 *
 * A new link supersedes any previous unused one (§11) — the old row is
 * revoked, not deleted, so opening the replaced link can honestly say the
 * link is dead instead of pretending the account is verified.
 */
export async function issueVerificationToken(userId: string): Promise<string> {
  await db
    .update(verificationTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(verificationTokens.userId, userId),
        eq(verificationTokens.purpose, "verify_email"),
        isNull(verificationTokens.consumedAt),
        isNull(verificationTokens.revokedAt),
      ),
    );

  const token = generateToken();

  await db.insert(verificationTokens).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: hashToken(token),
    purpose: "verify_email",
    expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 3_600_000),
  });

  return token;
}

export type ConsumeResult =
  /** Token claimed — the caller may now set `emailVerifiedAt`. */
  | { status: "ok"; userId: string }
  /** Already used: the account is verified and the link is spent (§7). */
  | { status: "consumed" }
  /** Past `expires_at` — never verifies (§12). */
  | { status: "expired" }
  /** Unknown, malformed, or superseded by a newer link (§13). */
  | { status: "invalid" };

/**
 * Consumes a verification token exactly once (§7).
 *
 * The claim is an `UPDATE … WHERE consumed_at IS NULL` so two racing opens
 * of the same URL can never both win: the loser sees `consumed` and the UI
 * reports "already verified" instead of verifying anything twice.
 */
export async function consumeVerificationToken(
  token: string,
): Promise<ConsumeResult> {
  const rows = await db
    .select({
      id: verificationTokens.id,
      userId: verificationTokens.userId,
      expiresAt: verificationTokens.expiresAt,
      consumedAt: verificationTokens.consumedAt,
      revokedAt: verificationTokens.revokedAt,
    })
    .from(verificationTokens)
    .where(eq(verificationTokens.tokenHash, hashToken(token)))
    .limit(1);

  const row = rows[0];
  // Tokens are compared as digests; an unknown hash means a bad link.
  if (!row) return { status: "invalid" };
  if (row.revokedAt) return { status: "invalid" };
  if (row.consumedAt) return { status: "consumed" };
  if (row.expiresAt <= new Date()) return { status: "expired" };

  const claimed = await db
    .update(verificationTokens)
    .set({ consumedAt: new Date() })
    .where(and(eq(verificationTokens.id, row.id), isNull(verificationTokens.consumedAt)))
    .returning({ id: verificationTokens.id });

  if (claimed.length === 0) return { status: "consumed" };
  return { status: "ok", userId: row.userId };
}

export type SendGate =
  | { blocked: false }
  | { blocked: true; message: string };

/**
 * Rate-limits verification emails per account (§11): at most four per hour,
 * and a 60-second cooldown between RESENDS. The very first resend after
 * sign-up is always allowed — the cooldown exists to throttle repeated
 * requests, not the student's own first retry.
 */
export async function verificationSendGate(userId: string): Promise<SendGate> {
  const rows = await db
    .select({ createdAt: verificationTokens.createdAt })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.userId, userId),
        eq(verificationTokens.purpose, "verify_email"),
      ),
    )
    .orderBy(desc(verificationTokens.createdAt));

  const now = Date.now();
  const hourly = rows.filter(
    (row) => now - row.createdAt.getTime() < RESEND_HOURLY_CAP * 3_600_000,
  );
  if (hourly.length >= RESEND_HOURLY_CAP) {
    return {
      blocked: true,
      message:
        "Too many confirmation links were requested for this account — try again later.",
    };
  }

  const newest = rows[0]?.createdAt;
  if (
    rows.length >= 2 &&
    newest &&
    now - newest.getTime() < RESEND_COOLDOWN_SECONDS * 1_000
  ) {
    return {
      blocked: true,
      message:
        "A new confirmation link was just sent — wait a minute before requesting another.",
    };
  }

  return { blocked: false };
}
