"use client";

import { useActionState } from "react";

import {
  removeSocialLinkAction,
  updateProfileAction,
  upsertSocialLinkAction,
} from "@/actions/projects";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Alert, Panel, PanelHeader } from "@/components/ui/Panel";
import { SOCIAL_PROVIDERS } from "@/lib/constants";

type Option = { id: string; name: string };

/** Only the fields the form edits — the session user itself never crosses
 *  the client boundary (its module is `server-only`). */
export type ProfileUser = {
  name: string;
  username: string | null;
  email: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  departmentId: string | null;
  batch: number | null;
  skills: string[] | null;
  githubUsername: string | null;
  portfolioUrl: string | null;
  location: string | null;
};

export type ProfileFormProps = {
  user: ProfileUser;
  departments: Option[];
  socials: Array<{ provider: string; url: string }>;
};

export function ProfileForm({ user, departments, socials }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(updateProfileAction, {});

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-6">
        {state.error && <Alert tone="danger">{state.error}</Alert>}
        {state.info && <Alert tone="success">{state.info}</Alert>}

        <Panel padded={false}>
          <PanelHeader title="Identity" description="How you appear in the directory." />
          <div className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="p-name" required error={state.fieldErrors?.name}>
                <Input
                  id="p-name"
                  name="name"
                  required
                  defaultValue={user.name}
                  invalid={Boolean(state.fieldErrors?.name)}
                />
              </Field>

              <Field
                label="Profile handle"
                htmlFor="p-username"
                required
                error={state.fieldErrors?.username}
                hint={`Public URL: /students/${user.username ?? "handle"}`}
              >
                <Input
                  id="p-username"
                  name="username"
                  required
                  defaultValue={user.username ?? ""}
                  invalid={Boolean(state.fieldErrors?.username)}
                />
              </Field>
            </div>

            <Field
              label="Headline"
              htmlFor="p-headline"
              error={state.fieldErrors?.headline}
              hint="One line — role, focus, year. e.g. “Embedded systems · Final year”"
            >
              <Input
                id="p-headline"
                name="headline"
                maxLength={120}
                defaultValue={user.headline ?? ""}
                invalid={Boolean(state.fieldErrors?.headline)}
              />
            </Field>

            <Field
              label="Bio"
              htmlFor="p-bio"
              error={state.fieldErrors?.bio}
              hint="A short paragraph about what you build and care about."
            >
              <Textarea
                id="p-bio"
                name="bio"
                rows={4}
                maxLength={800}
                defaultValue={user.bio ?? ""}
                invalid={Boolean(state.fieldErrors?.bio)}
              />
            </Field>

            <Field label="Profile photo" htmlFor="p-avatar" hint="JPG, PNG, WebP or AVIF · max 4 MB.">
              <input
                id="p-avatar"
                name="avatar"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="block w-full text-xs text-gh-fg-muted file:mr-3 file:rounded file:border file:border-gh-border file:bg-gh-btn-bg file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gh-fg-default hover:file:bg-gh-btn-hover"
              />
            </Field>
          </div>
        </Panel>

        <Panel padded={false}>
          <PanelHeader title="Academics" description="Used for department filters and batch grouping." />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field
              label="Department"
              htmlFor="p-department"
              required={departments.length > 0}
              error={state.fieldErrors?.departmentId}
              hint={
                departments.length === 0
                  ? "No departments are configured yet — pick yours once your admin adds them."
                  : undefined
              }
            >
              <Select
                id="p-department"
                name="departmentId"
                defaultValue={user.departmentId ?? ""}
                required={departments.length > 0}
              >
                <option value="" disabled={departments.length > 0}>
                  {departments.length > 0 ? "Choose a department…" : "Not set"}
                </option>
                {departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Graduation year" htmlFor="p-batch" required error={state.fieldErrors?.batch}>
              <Input
                id="p-batch"
                name="batch"
                type="number"
                inputMode="numeric"
                min={2000}
                required
                defaultValue={user.batch ?? ""}
                invalid={Boolean(state.fieldErrors?.batch)}
                placeholder="2026"
              />
            </Field>

            <Field
              label="Skills"
              htmlFor="p-skills"
              className="sm:col-span-2"
              error={state.fieldErrors?.skills}
              hint="Comma separated, max 20 — e.g. React, TypeScript, TensorFlow"
            >
              <Input
                id="p-skills"
                name="skills"
                defaultValue={(user.skills ?? []).join(", ")}
                invalid={Boolean(state.fieldErrors?.skills)}
                placeholder="React, Python, Figma"
              />
            </Field>
          </div>
        </Panel>

        <Panel padded={false}>
          <PanelHeader title="Links" description="Optional — empty fields stay hidden publicly." />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field
              label="GitHub username"
              htmlFor="p-github"
              error={state.fieldErrors?.githubUsername}
              hint="Just the handle — no URL needed."
            >
              <Input
                id="p-github"
                name="githubUsername"
                defaultValue={user.githubUsername ?? ""}
                invalid={Boolean(state.fieldErrors?.githubUsername)}
                placeholder="octocat"
              />
            </Field>

            <Field label="Portfolio" htmlFor="p-portfolio" error={state.fieldErrors?.portfolioUrl}>
              <Input
                id="p-portfolio"
                name="portfolioUrl"
                type="url"
                defaultValue={user.portfolioUrl ?? ""}
                invalid={Boolean(state.fieldErrors?.portfolioUrl)}
                placeholder="https://…"
              />
            </Field>

            <Field label="Location" htmlFor="p-location" error={state.fieldErrors?.location}>
              <Input
                id="p-location"
                name="location"
                maxLength={80}
                defaultValue={user.location ?? ""}
                invalid={Boolean(state.fieldErrors?.location)}
                placeholder="Kochi, Kerala"
              />
            </Field>
          </div>
        </Panel>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={pending}
            leadingIcon={pending ? "progress_activity" : "save"}
          >
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>

      <SocialLinks socials={socials} />
    </div>
  );
}

function SocialLinks({ socials }: { socials: Array<{ provider: string; url: string }> }) {
  const [addState, addAction, addPending] = useActionState(
    upsertSocialLinkAction,
    {},
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeSocialLinkAction,
    {},
  );

  const used = new Set(socials.map((item) => item.provider));
  const available = SOCIAL_PROVIDERS.filter((item) => !used.has(item.value));
  const message = addState.error ?? addState.info ?? removeState.error ?? removeState.info ?? null;
  const failed = Boolean(addState.error ?? removeState.error);

  return (
    <Panel padded={false}>
      <PanelHeader
        title="Connected accounts"
        description="Icons only appear on your public profile for networks listed here."
      />
      <div className="space-y-4 p-5">
        {socials.length === 0 ? (
          <p className="text-sm text-gh-fg-muted">
            No links connected yet — your public profile shows none until you add one.
          </p>
        ) : (
          <ul className="space-y-2">
            {socials.map((item) => (
              <li
                key={item.provider}
                className="flex items-center gap-3 rounded-md border border-gh-border bg-gh-inset px-3 py-2"
              >
                <Icon name="link" size={15} className="shrink-0 text-gh-fg-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-gh-fg-default">
                    {SOCIAL_PROVIDERS.find((entry) => entry.value === item.provider)?.label ??
                      item.provider}
                  </p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block truncate font-mono text-[11px] text-gh-accent hover:underline"
                  >
                    {item.url}
                  </a>
                </div>
                <form action={removeAction}>
                  <input type="hidden" name="provider" value={item.provider} />
                  <button
                    type="submit"
                    disabled={removePending}
                    aria-label={`Disconnect ${item.provider}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gh-fg-muted transition-colors hover:bg-gh-btn-hover hover:text-gh-danger disabled:opacity-50"
                  >
                    <Icon name="close" size={15} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        {available.length > 0 && (
          <form
            action={addAction}
            className="grid gap-3 border-t border-gh-border pt-4 sm:grid-cols-[160px_minmax(0,1fr)_auto]"
          >
            <Field label="Network" htmlFor="s-provider" error={addState.fieldErrors?.provider}>
              <Select
                id="s-provider"
                name="provider"
                defaultValue={available[0].value}
                invalid={Boolean(addState.fieldErrors?.provider)}
              >
                {available.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="URL" htmlFor="s-url" error={addState.fieldErrors?.url}>
              <Input
                id="s-url"
                name="url"
                type="url"
                required
                invalid={Boolean(addState.fieldErrors?.url)}
                placeholder="https://…"
              />
            </Field>

            <div className="flex items-end">
              <Button
                type="submit"
                variant="default"
                disabled={addPending}
                leadingIcon={addPending ? "progress_activity" : "add_link"}
              >
                {addPending ? "Saving…" : "Connect"}
              </Button>
            </div>
          </form>
        )}

        {message && <Alert tone={failed ? "danger" : "success"}>{message}</Alert>}
      </div>
    </Panel>
  );
}
