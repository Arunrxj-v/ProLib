import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, resolving Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** URL-safe slug with collision suffixes handled by the caller. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

/** "Arunraj V" -> "AV" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Stable accent picked from a string so avatars are consistent per person. */
export function avatarTone(seed: string): "accent" | "success" | "attention" | "done" | "danger" {
  const tones = ["accent", "success", "attention", "done", "danger"] as const;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return tones[Math.abs(hash) % tones.length];
}

/** 1840 -> "1.8k", 1200000 -> "1.2m" */
export function compactNumber(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const scaled = value / 1000;
    return `${scaled >= 100 ? Math.round(scaled) : scaled.toFixed(1).replace(/\.0$/, "")}k`;
  }
  const scaled = value / 1_000_000;
  return `${scaled.toFixed(1).replace(/\.0$/, "")}m`;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

export function formatDate(value: Date | number | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value * 1000);
  return dateFormatter.format(date);
}

export function formatMonthYear(value: Date | number | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value * 1000);
  return monthFormatter.format(date);
}

/** "3 hours ago" — used for activity feeds. */
export function relativeTime(value: Date | number | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value * 1000);
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const divisions: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.34524, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Number.POSITIVE_INFINITY, unit: "year" },
  ];
  let duration = seconds;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return formatter.format(Math.round(duration), "year");
}

/** Absolute URL for metadata / share links / OAuth callbacks. */
export function absoluteUrl(path = "/"): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    // Single service today; these let the same build point at split
    // frontend/backend origins after the home-server move.
    process.env.FRONTEND_URL ??
    process.env.API_URL ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Truncate on a word boundary for meta descriptions. */
export function truncate(text: string, length = 160): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= length) return normalized;
  const cut = normalized.slice(0, length);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
