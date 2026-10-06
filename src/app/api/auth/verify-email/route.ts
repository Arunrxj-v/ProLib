import { and, eq, isNull } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import {
  consumeVerificationToken,
} from "@/lib/auth/verification";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * The endpoint every verification email links to (§4, §29).
 *
 * Opening this URL *is* the verification step: it consumes the single-use
 * token in one atomic update and redirects to a status page. There is no
 * button, no session requirement, and no path that marks an account
 * verified without presenting a live token that only arrived by email.
 *
 * Every outcome is an honest redirect:
 *   ok       → /verify-email?status=verified
 *   consumed → /verify-email?status=already   (§7: "already verified")
 *   expired  → /verify-email?status=expired    (§12)
 *   invalid  → /verify-email?status=invalid    (§13)
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const rawNext = request.nextUrl.searchParams.get("next");

  const go = (status: string) => {
    const params = new URLSearchParams({ status });
    if (rawNext) params.set("next", rawNext);
    return NextResponse.redirect(
      new URL(`/verify-email?${params.toString()}`, request.url),
      303,
    );
  };

  if (!token || token.trim().length < 10) return go("invalid");

  const result = await consumeVerificationToken(token.trim());
  if (result.status !== "ok") {
    if (result.status === "consumed") return go("already");
    if (result.status === "expired") return go("expired");
    return go("invalid");
  }

  // Token proven — record verification (idempotent: an account already
  // verified through Google keeps its original timestamp).
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(users.id, result.userId), isNull(users.emailVerifiedAt)));

  return go("verified");
}
