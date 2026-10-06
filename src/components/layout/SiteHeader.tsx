import { getCurrentUser } from "@/lib/auth/session";

import { HeaderShell, type HeaderUser } from "./HeaderShell";

/** Server wrapper: resolves the session once, then renders the client shell. */
export async function SiteHeader() {
  const user = await getCurrentUser();

  const headerUser: HeaderUser | null = user
    ? {
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl,
        role: user.role,
      }
    : null;

  return <HeaderShell user={headerUser} />;
}
