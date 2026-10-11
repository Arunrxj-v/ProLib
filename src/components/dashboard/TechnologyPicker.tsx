"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Form";
import { cn, slugify } from "@/lib/utils";

type Option = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  kind: string;
};

/**
 * Multi-select for the project stack with inline "add your own" support.
 *
 * ONE source of truth: the parent's `selected` id list. Chips, checkbox
 * checked-state, the count line and the fields that travel in FormData are
 * all derived from it — the ids are submitted through hidden inputs rendered
 * from `selected`, so a React form reset after a failed action can never
 * desynchronise what the server receives from what the student sees. The
 * checkboxes keep their `technologyIds` name for the no-JS fallback (the
 * server deduplicates). Anything the student types travels as repeated
 * `technologyNames` inputs — the server upserts those into the
 * `technologies` table, so a brand-new instance with an empty technology
 * list is still fully usable (and never fakes options).
 */
export function TechnologyPicker({
  options,
  selected,
  onChange,
  error,
}: {
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState<Option[]>([]);

  // Normalised selection — duplicates can never reach chips, state or FormData.
  const selectedIds = [...new Set(selected)];

  const allOptions = [...options, ...added];
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  const filtered = trimmed
    ? allOptions.filter(
        (option) =>
          option.name.toLowerCase().includes(lower) ||
          option.kind.toLowerCase().includes(lower),
      )
    : allOptions;

  const chosen = selectedIds
    .map((id) => allOptions.find((option) => option.id === id))
    .filter((option): option is Option => Boolean(option));

  const exactExists = allOptions.some((option) => option.name.toLowerCase() === lower);
  const canAdd = trimmed.length > 0 && !exactExists;

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((value) => value !== id)
        : [...selectedIds, id],
    );
  }

  function addCustom() {
    const name = trimmed.slice(0, 40);
    if (!name) return;
    const id = `new:${slugify(name) || name.toLowerCase()}`;
    if (!allOptions.some((option) => option.id === id)) {
      setAdded((current) => [
        ...current,
        { id, name, slug: slugify(name), icon: null, kind: "typed in" },
      ]);
    }
    if (!selectedIds.includes(id)) onChange([...selectedIds, id]);
    setQuery("");
  }

  // A stale server error must not outlive the fix: once anything is
  // selected, the "add at least one technology" message clears immediately.
  const visibleError = selectedIds.length === 0 ? error : undefined;

  return (
    <fieldset className="space-y-3">
      <legend className="font-mono text-xs font-medium text-gh-fg-muted">
        Technologies used
        <span className="ml-1 text-gh-accent" aria-hidden>
          *
        </span>
      </legend>

      <div className="space-y-2">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            options.length > 0
              ? "Filter the list — or type to add a new one…"
              : "Type a technology — e.g. React, Python, Flutter…"
          }
          aria-label="Filter or add technologies"
        />
        {canAdd && (
          <button
            type="button"
            onClick={addCustom}
            className="inline-flex items-center gap-1.5 rounded border border-gh-border bg-gh-inset px-2.5 py-1.5 text-xs font-medium text-gh-fg-default transition-colors hover:border-gh-accent hover:text-gh-accent"
          >
            <Icon name="add" size={14} />
            Add “{trimmed}”
          </button>
        )}
      </div>

      {chosen.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chosen.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option.id)}
              className="inline-flex items-center gap-1 rounded border border-[rgba(56,139,253,0.35)] bg-[rgba(56,139,253,0.1)] px-2 py-0.5 font-mono text-xs text-gh-accent transition-colors hover:border-gh-danger hover:text-gh-danger"
              aria-label={`Remove ${option.name}`}
            >
              {option.name}
              <Icon name="close" size={12} />
            </button>
          ))}
        </div>
      )}

      {/* The whole selection travels as hidden ids — rendered from state,
          so chips, checkboxes and the posted FormData can never disagree. */}
      {selectedIds.map((id) => (
        <input key={`id-${id}`} type="hidden" name="technologyIds" value={id} />
      ))}

      {/* Typed-in technologies travel as names — the server upserts them. */}
      {chosen
        .filter((option) => option.id.startsWith("new:"))
        .map((option) => (
          <input
            key={`name-${option.id}`}
            type="hidden"
            name="technologyNames"
            value={option.name}
          />
        ))}

      <div className="max-h-56 overflow-y-auto rounded-md border border-gh-border bg-gh-inset p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-gh-fg-muted">
            {trimmed
              ? `Nothing matches “${trimmed}” — use “Add” to include it.`
              : "No technologies listed yet — type a name above to add yours."}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {filtered.map((option) => {
              const active = selectedIds.includes(option.id);
              return (
                <li key={option.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                      active
                        ? "bg-[rgba(56,139,253,0.12)] text-gh-accent"
                        : "text-gh-fg-muted hover:bg-gh-btn-hover hover:text-gh-fg-default",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="technologyIds"
                      value={option.id}
                      checked={active}
                      onChange={() => toggle(option.id)}
                      className="h-3.5 w-3.5 shrink-0 accent-[#58a6ff]"
                    />
                    <span className="truncate">{option.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p
        className={cn(
          "font-mono text-[11px]",
          visibleError ? "text-gh-danger" : "text-gh-fg-subtle",
        )}
      >
        {visibleError ??
          `${selectedIds.length} selected · pick everything the stack actually uses`}
      </p>
    </fieldset>
  );
}
