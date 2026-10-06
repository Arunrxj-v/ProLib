"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { savePlatformSettingsAction, type AdminActionState } from "@/actions/admin";
import { StateAlert } from "@/components/admin/StateAlert";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/Form";
import { Panel, PanelHeader } from "@/components/ui/Panel";

export type SettingsValues = {
  moderationEnabled: boolean;
  requireEmailVerification: boolean;
  allowedEmailDomains: string;
  siteAnnouncement: string;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Saving…" : "Save settings"}
    </Button>
  );
}

/** Platform-wide switches stored in the `settings` table. */
export function SettingsForm({ values }: { values: SettingsValues }) {
  const [state, action] = useActionState<AdminActionState, FormData>(
    savePlatformSettingsAction,
    {},
  );
  const errors = state.fieldErrors ?? {};
  const repopulated = state.values;

  const domains = repopulated?.allowedEmailDomains ?? values.allowedEmailDomains;
  const announcement = repopulated?.siteAnnouncement ?? values.siteAnnouncement;
  const moderationOn = repopulated
    ? repopulated.moderationEnabled === "on"
    : values.moderationEnabled;
  const verificationOn = repopulated
    ? repopulated.requireEmailVerification === "on"
    : values.requireEmailVerification;

  return (
    <form action={action} className="space-y-6">
      <StateAlert state={state} />

      <Panel padded={false}>
        <PanelHeader
          title="Moderation"
          description="Applies to every new submission immediately."
        />
        <div className="space-y-1 p-5">
          <Checkbox
            name="moderationEnabled"
            defaultChecked={moderationOn}
            label="Require approval before projects go public"
            description="Drafts stay private until an admin approves or publishes them. Turning this off lets students publish their own work."
          />
          <Checkbox
            name="requireEmailVerification"
            defaultChecked={verificationOn}
            label="Require a verified email address"
            description="Students must confirm their college address before signing in."
          />
        </div>
      </Panel>

      <Panel padded={false}>
        <PanelHeader
          title="Sign-ups"
          description="Control who may register an account."
        />
        <div className="space-y-4 p-5">
          <Field
            label="Allowed email domains"
            htmlFor="settings-domains"
            error={errors.allowedEmailDomains}
            hint="Comma separated. Leave empty to accept any address."
          >
            <Input
              id="settings-domains"
              name="allowedEmailDomains"
              defaultValue={domains}
              placeholder="student.prolib.edu, prolib.edu"
              invalid={Boolean(errors.allowedEmailDomains)}
            />
          </Field>
          <Field
            label="Site announcement"
            htmlFor="settings-announcement"
            error={errors.siteAnnouncement}
            hint={`Shown in the header strip. ${announcement.length}/400 characters.`}
          >
            <Textarea
              id="settings-announcement"
              name="siteAnnouncement"
              rows={3}
              maxLength={400}
              defaultValue={announcement}
              invalid={Boolean(errors.siteAnnouncement)}
              placeholder="Showcase submissions close on 12 December."
            />
          </Field>
        </div>
      </Panel>

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}
