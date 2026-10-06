"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/**
 * Route-level error boundary. Shows what failed and offers a retry instead of
 * failing silently.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[prolib] render error", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-md border border-gh-border bg-gh-subtle">
        <Icon name="error" size={24} tone="danger" />
      </span>
      <h1 className="text-xl font-semibold text-gh-fg-default">
        Something went wrong on this screen
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-gh-fg-muted">
        The request could not be completed. Your work is not lost — try again,
        or head back to the library.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-gh-fg-subtle">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <Button variant="primary" onClick={retry} trailingIcon="refresh">
          Try again
        </Button>
        <Button variant="default" onClick={() => router.push("/")}>
          Back to ProLib
        </Button>
      </div>
    </div>
  );
}
