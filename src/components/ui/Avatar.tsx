"use client";

import Image from "next/image";
import { useState } from "react";

import { isRenderableImageSrc } from "@/lib/imageHosts";
import { avatarTone, cn, initials } from "@/lib/utils";

const TONE_CLASS = {
  accent: "bg-gh-accent text-white",
  success: "bg-gh-success text-white",
  attention: "bg-gh-attention text-gh-inset",
  done: "bg-gh-done text-white",
  danger: "bg-gh-danger-emphasis text-white",
} as const;

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-7 w-7 text-[10px]",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-2xl",
} as const;

export type AvatarProps = {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  /** Small ring that reads as "verified/online" in the design. */
  verified?: boolean;
  className?: string;
  priority?: boolean;
};

/**
 * Profile photo when one exists, otherwise deterministic initials on an
 * accent surface — never an empty circle.
 *
 * Renders only srcs next/image can actually serve (same-origin /uploads/…
 * or the allowlisted Google host — see src/lib/imageHosts.ts). A malformed,
 * disallowed, or unavailable URL degrades to the same initials fallback
 * instead of crashing the page: next/image throws during render for an
 * unconfigured hostname, and the browser's onError covers 404s/network
 * failures after hydration.
 */
export function Avatar({
  name,
  src,
  size = "md",
  verified,
  className,
  priority,
}: AvatarProps) {
  const tone = TONE_CLASS[avatarTone(name)];
  const [failed, setFailed] = useState(false);

  const candidate = typeof src === "string" ? src.trim() : "";
  const showImage = Boolean(candidate) && !failed && isRenderableImageSrc(candidate);

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {showImage ? (
        <Image
          src={candidate}
          alt={`${name}'s profile picture`}
          width={size === "xl" ? 80 : size === "lg" ? 48 : size === "md" ? 40 : 28}
          height={size === "xl" ? 80 : size === "lg" ? 48 : size === "md" ? 40 : 28}
          className={cn(
            "rounded-full border border-gh-border object-cover",
            SIZES[size],
          )}
          priority={priority}
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "inline-flex items-center justify-center rounded-full font-mono font-bold",
            SIZES[size],
            tone,
          )}
        >
          {initials(name)}
        </span>
      )}
      {verified && (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-gh-success ring-2 ring-gh-card" />
      )}
    </span>
  );
}

/** Overlapping stack used on project cards. */
export function AvatarStack({
  people,
  max = 3,
  size = "sm",
}: {
  people: Array<{ id: string; name: string; avatarUrl?: string | null }>;
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <span className="flex -space-x-2">
      {shown.map((person) => (
        <span
          key={person.id}
          className="rounded-full ring-2 ring-gh-card"
          title={person.name}
        >
          <Avatar name={person.name} src={person.avatarUrl} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-gh-btn-bg font-mono font-medium text-gh-fg-default ring-2 ring-gh-border",
            SIZES[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
