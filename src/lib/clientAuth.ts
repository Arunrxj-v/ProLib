/**
 * Client-side sign-out for ProLib (imported only from "use client" trees).
 *
 * Calls the existing `POST /api/auth/logout`, which deletes the session
 * row server-side and clears the httpOnly cookie, then navigates to the
 * public Explore page and refreshes so the authenticated navigation
 * disappears. Google is never involved — this is a ProLib-only sign-out.
 */
type RouterLike = {
  push: (href: string) => void;
  refresh: () => void;
};

export async function signOutOfProLib(router: RouterLike): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) return false;
    router.push("/explore");
    router.refresh();
    return true;
  } catch {
    return false;
  }
}
