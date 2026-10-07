"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Icon } from "@/components/ui/Icon";
import { withBase } from "@/lib/base-path";
import { cn, compactNumber } from "@/lib/utils";

/**
 * Like toggle. Anonymous visitors are sent to sign-in instead of getting a
 * silent failure, and the server is the source of truth for the new count.
 */
export function LikeButton({
  slug,
  signedIn,
  initialLiked,
  initialCount,
  className,
}: {
  slug: string;
  signedIn: boolean;
  initialLiked: boolean;
  initialCount: number;
  className?: string;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!signedIn) {
      router.push(`/login?next=/projects/${slug}`);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          withBase(`/api/projects/${encodeURIComponent(slug)}/like`),
          { method: "POST" },
        );

        if (response.status === 401) {
          router.push(`/login?next=/projects/${slug}`);
          return;
        }
        if (!response.ok) throw new Error("Like failed");

        const data = (await response.json()) as {
          liked: boolean;
          likeCount: number;
        };
        setLiked(data.liked);
        setCount(data.likeCount);
      } catch {
        setError("Could not save your like. Try again.");
      }
    });
  }

  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={liked}
        aria-label={liked ? "Remove your like" : "Like this project"}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-all",
          "disabled:opacity-60",
          liked
            ? "border-[rgba(210,153,34,0.45)] bg-[rgba(210,153,34,0.12)] text-gh-attention"
            : "border-gh-border bg-gh-btn-bg text-gh-fg-muted hover:bg-gh-btn-hover hover:text-gh-fg-default",
        )}
      >
        <Icon name={liked ? "star" : "star_border"} size={16} tone={liked ? "attention" : "inherit"} />
        <span>{compactNumber(count)}</span>
      </button>
      {error && (
        <span role="alert" className="text-[11px] text-gh-danger">
          {error}
        </span>
      )}
    </span>
  );
}
