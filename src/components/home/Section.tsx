import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Standard section frame: full-bleed rule, 1280px content column. */
export function Section({
  children,
  className,
  id,
  divided = true,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  divided?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "w-full",
        divided && "border-b border-gh-border-muted",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-14">{children}</div>
    </section>
  );
}
