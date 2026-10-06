import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * `GET /api/auth/me` — the frontend's single source of truth about who is
 * signed in (§27).
 *
 * Always answers with JSON and never hangs:
 *   200 `{ authenticated: true,  user: {...} }`
 *   200 `{ authenticated: false }`  — no/expired session
 *   500 `{ error, message }`        — server failure, stated honestly
 *
 * Auth is verified entirely server-side (httpOnly cookie → session row);
 * the browser never holds a claim of its own.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ authenticated: false });
    }

    return Response.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        // `image` is the contract name clients expect; `avatarUrl` is kept
        // as the internal alias so both agree (null when never uploaded).
        image: user.avatarUrl,
        avatarUrl: user.avatarUrl,
        username: user.username,
        role: user.role,
        departmentId: user.departmentId,
        batch: user.batch,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
