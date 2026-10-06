import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SettingsForm, type SettingsValues } from "@/components/admin/SettingsForm";
import { LinkButton } from "@/components/ui/Button";
import { requireAdmin } from "@/lib/auth/guards";
import { SETTING_KEYS, readSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Settings",
  description: "Platform-wide moderation, sign-up and announcement settings.",
};

export default async function AdminSettingsPage() {
  await requireAdmin();

  const stored = await readSettings([
    SETTING_KEYS.moderationEnabled,
    SETTING_KEYS.requireEmailVerification,
    SETTING_KEYS.allowedEmailDomains,
    SETTING_KEYS.siteAnnouncement,
  ]);

  const values: SettingsValues = {
    moderationEnabled: stored[SETTING_KEYS.moderationEnabled] !== "false",
    requireEmailVerification: stored[SETTING_KEYS.requireEmailVerification] !== "false",
    allowedEmailDomains: stored[SETTING_KEYS.allowedEmailDomains]
      .split(",")
      .map((domain) => domain.trim())
      .filter(Boolean)
      .join(", "),
    siteAnnouncement: stored[SETTING_KEYS.siteAnnouncement],
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Moderation"
        title="Platform settings"
        description="These values are read on every request, so changes take effect immediately across the public library, sign-up and the review queue."
        action={
          <LinkButton href="/admin" variant="ghost" leadingIcon="space_dashboard">
            Overview
          </LinkButton>
        }
      />

      <SettingsForm values={values} />
    </div>
  );
}
