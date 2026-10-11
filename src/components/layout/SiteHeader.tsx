import { getCurrentUser } from "@/lib/auth/session";
import { countUnreadNotifications } from "@/lib/data/notifications";

import { HeaderShell, type HeaderUser } from "./HeaderShell";

/** Server wrapper: resolves the session once, then renders the client shell. */
export async function SiteHeader() {
  const user = await getCurrentUser();

  const headerUser: HeaderUser | null = user
    ? {
        name: user.name,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
      }
    : null;

  // Bell indicator: the real unread count at render time. A failed count
  // query must never produce a false indicator — it degrades to zero.
  const unreadCount = user
    ? await countUnreadNotifications(user.id).catch(() => 0)
    : 0;

  return <HeaderShell user={headerUser} unreadCount={unreadCount} />;
}
