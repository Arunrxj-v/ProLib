import "server-only";

import { inArray } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export const SETTING_KEYS = {
  moderationEnabled: "moderation_enabled",
  requireEmailVerification: "require_email_verification",
  allowedEmailDomains: "allowed_email_domains",
  siteAnnouncement: "site_announcement",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/**
 * Documented fallbacks used while the `settings` table has no rows — i.e. on a
 * brand-new instance.
 *
 * `moderationEnabled` defaults to **off** so a fresh install is usable with a
 * zero-account database: a student publishing their first project sees it go
 * live immediately instead of waiting for a moderator who doesn't exist yet.
 * An admin can switch moderation on from Admin → Settings at any time.
 */
const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.moderationEnabled]: "false",
  [SETTING_KEYS.requireEmailVerification]: "true",
  [SETTING_KEYS.allowedEmailDomains]: "",
  [SETTING_KEYS.siteAnnouncement]: "",
};

/** Reads several settings in one query, falling back to documented defaults. */
export const readSettings = cache(async (keys: string[]) => {
  const rows = await db
    .select()
    .from(settings)
    .where(inArray(settings.key, keys));

  const found = new Map(rows.map((row) => [row.key, row.value]));
  return Object.fromEntries(
    keys.map((key) => [key, found.get(key) ?? DEFAULTS[key] ?? ""]),
  ) as Record<string, string>;
});

export async function getSetting(key: SettingKey | string): Promise<string> {
  const values = await readSettings([key]);
  return values[key];
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/** Only `approved`/`published` projects are public while moderation is on. */
export async function isModerationEnabled(): Promise<boolean> {
  const value = await getSetting(SETTING_KEYS.moderationEnabled);
  return value !== "false";
}

/**
 * Optional allow-list of college email domains (comma separated).
 * Empty string means "any email is accepted".
 */
export async function getAllowedEmailDomains(): Promise<string[]> {
  const value = await getSetting(SETTING_KEYS.allowedEmailDomains);
  return value
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export async function isEmailDomainAllowed(email: string): Promise<boolean> {
  const domains = await getAllowedEmailDomains();
  if (domains.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return domains.includes(domain);
}

export async function isEmailVerificationRequired(): Promise<boolean> {
  const value = await getSetting(SETTING_KEYS.requireEmailVerification);
  return value !== "false";
}
