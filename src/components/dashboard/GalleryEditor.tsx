"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";

import {
  removeGalleryImageAction,
  uploadGalleryImageAction,
} from "@/actions/projects";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Alert, EmptyState } from "@/components/ui/Panel";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/utils";

type ImageRow = { id: string; path: string; alt: string | null };

/**
 * Gallery upload + removal. Files go straight through the server action, so
 * type/size validation happens on the server and the list revalidates itself.
 */
export function GalleryEditor({
  projectId,
  images,
  title,
}: {
  projectId: string;
  images: ImageRow[];
  title: string;
}) {
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadGalleryImageAction,
    {},
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeGalleryImageAction,
    {},
  );

  const message = uploadState.error ?? uploadState.info ?? removeState.error ?? removeState.info ?? null;
  const failed = Boolean(uploadState.error ?? removeState.error);

  return (
    <div className="space-y-4">
      {images.length === 0 ? (
        <EmptyState
          icon="photo_library"
          title="No gallery images yet"
          description="Add a couple of screenshots so visitors can see the work before they read about it."
          compact
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image) => (
            <li
              key={image.id}
              className="overflow-hidden rounded-md border border-gh-border bg-gh-inset"
            >
              <div className="relative aspect-video">
                <Image
                  src={withBase(image.path)}
                  alt={image.alt ?? `${title} screenshot`}
                  fill
                  sizes="(max-width: 640px) 50vw, 220px"
                  className="object-cover"
                />
              </div>

              <form
                action={removeAction}
                className="flex items-center justify-between gap-2 border-t border-gh-border px-2 py-1.5"
              >
                <input type="hidden" name="imageId" value={image.id} />
                <Link
                  href={withBase(image.path)}
                  className="truncate font-mono text-[10px] text-gh-fg-subtle hover:text-gh-accent"
                >
                  Open
                </Link>
                <button
                  type="submit"
                  disabled={removePending}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-gh-fg-muted transition-colors hover:bg-gh-danger-emphasis hover:text-white disabled:opacity-50"
                  aria-label="Remove this image"
                >
                  <Icon name="delete" size={13} />
                  {removePending ? "…" : "Remove"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form
        action={uploadAction}
        className={cn(
          "flex flex-col gap-3 rounded-md border border-dashed border-gh-border bg-gh-inset p-4 sm:flex-row sm:items-end",
        )}
      >
        <input type="hidden" name="projectId" value={projectId} />

        <div className="flex-1">
          <label
            htmlFor="gallery-files"
            className="block font-mono text-xs font-medium text-gh-fg-muted"
          >
            Add images
          </label>
          <input
            id="gallery-files"
            name="images"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="mt-1.5 block w-full text-xs text-gh-fg-muted file:mr-3 file:rounded file:border file:border-gh-border file:bg-gh-btn-bg file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gh-fg-default hover:file:bg-gh-btn-hover"
          />
          <p className="mt-1.5 text-[11px] text-gh-fg-subtle">
            JPG, PNG, WebP or AVIF · up to 4 MB each.
          </p>
        </div>

        <Button
          type="submit"
          variant="default"
          disabled={uploadPending}
          leadingIcon={uploadPending ? "progress_activity" : "upload"}
        >
          {uploadPending ? "Uploading…" : "Upload"}
        </Button>
      </form>

      {message && (
        <Alert tone={failed ? "danger" : "success"}>{message}</Alert>
      )}
    </div>
  );
}
