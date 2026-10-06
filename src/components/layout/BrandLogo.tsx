import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * ProLib brand mark — taken verbatim from the supplied `prolib_brand_logo`
 * SVG (book-spine / code-bracket motif).
 */
export function BrandMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <rect
        x="0.75"
        y="0.75"
        width="30.5"
        height="30.5"
        rx="7.25"
        fill="#1E293B"
        stroke="#334155"
        strokeWidth="1.5"
      />
      <path
        d="M9 11L14 16L9 21"
        stroke="#3B82F6"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M23 11L18 16L23 21"
        stroke="#06B6D4"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="16"
        y1="9"
        x2="16"
        y2="23"
        stroke="#94A3B8"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="2 2"
      />
    </svg>
  );
}

/**
 * Full lockup: mark + wordmark. "Pro" is set in the page foreground and
 * "Lib" in the brand blue, exactly as in the brand file, followed by the
 * green library-active dot.
 */
export function BrandLogo({
  size = 28,
  className,
  compact,
}: {
  size?: number;
  className?: string;
  /** Hide the wordmark (used on very small screens). */
  compact?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={size} />
      {!compact && (
        <span
          className="text-lg font-extrabold tracking-tight leading-none"
          style={{ color: "#F8FAFC" }}
        >
          Pro<span style={{ color: "#3B82F6" }}>Lib</span>
          <span
            aria-hidden
            className="ml-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
            style={{ background: "#10B981" }}
          />
        </span>
      )}
    </span>
  );
}

/** Link wrapper used in the header and footer. */
export function BrandLink({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="ProLib home"
      className={cn("rounded-md", className)}
    >
      <BrandLogo compact={compact} />
    </Link>
  );
}
