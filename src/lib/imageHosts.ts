/**
 * External image hosts ProLib is allowed to render through next/image.
 *
 * Single source of truth: next.config.ts turns this list into
 * `images.remotePatterns` (HTTPS only, exact hostnames), and Avatar uses it
 * to decide whether a stored URL can safely be handed to next/image — an
 * unconfigured hostname throws *during render*, so the component falls back
 * to the initials circle instead of crashing the page.
 *
 * `lh3.googleusercontent.com`: profile pictures from Google OAuth — the
 * callback stores userinfo's `picture` value in users.avatarUrl. Uploaded
 * avatars/covers are same-origin `/uploads/…` paths and need no entry.
 * GitHub's avatars.githubusercontent.com is deliberately absent: the GitHub
 * flow stores that URL in github_accounts and only ever renders the @login
 * as text, never the image.
 */
export const REMOTE_IMAGE_HOSTS = ["lh3.googleusercontent.com"] as const;

/**
 * Whether a stored avatar URL may be rendered by next/image:
 * a same-origin absolute path (never protocol-relative `//host`), or an
 * https URL on an allowlisted host. Anything else — a malformed string, a
 * plain-http or foreign-host URL — is not renderable and callers should
 * fall back to initials.
 */
export function isRenderableImageSrc(src: string): boolean {
  if (src.startsWith("/")) return !src.startsWith("//");
  try {
    const url = new URL(src);
    return (
      url.protocol === "https:" &&
      (REMOTE_IMAGE_HOSTS as readonly string[]).includes(url.hostname)
    );
  } catch {
    return false;
  }
}
