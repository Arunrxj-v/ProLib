import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { verificationTokens } from "@/lib/db/schema";

import { generateToken, hashToken } from "./tokens";

const TOKEN_TTL_HOURS = 24;

/** Creates a single-use college-email verification token. */
export async function issueVerificationToken(userId: string): Promise<string> {
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

/** Returns the owning user id, or null when the token is invalid/expired. */
export async function consumeVerificationToken(
  token: string,
): Promise<string | null> {
  const rows = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.tokenHash, hashToken(token)),
        isNull(verificationTokens.consumedAt),
        gt(verificationTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  await db
    .update(verificationTokens)
    .set({ consumedAt: new Date() })
    .where(eq(verificationTokens.id, row.id));

  return row.userId;
}
