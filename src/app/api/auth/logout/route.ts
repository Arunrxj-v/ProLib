import { handleApiError } from "@/lib/api";
import { destroyCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * `POST /api/auth/logout` — destroys the session row and clears the cookie.
 * Idempotent: logging out without a session still answers 200.
 */
export async function POST() {
  try {
    await destroyCurrentSession();
    return Response.json({ authenticated: false });
  } catch (error) {
    return handleApiError(error);
  }
}
