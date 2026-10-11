"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, type FormEvent } from "react";

import { removeGalleryImageAction } from "@/actions/projects";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Alert, EmptyState } from "@/components/ui/Panel";
import { cn } from "@/lib/utils";

type ImageRow = { id: string; path: string; alt: string | null };

/**
 * Gallery upload + removal, split across the two surfaces each payload
 * belongs to:
 *
 *   - Uploads POST multipart FormData to `POST /api/projects/:id/images`
 *     — the dedicated authenticated endpoint (requireApiUser + owner gate,
 *     type/size/count validation in the shared storage/service layer).
 *     Files never ride a Server Action body, so a batch of multi-MB
 *     screenshots is not bounded by `serverActions.bodySizeLimit`.
 *     On success the router refreshes, so the list below re-renders from
 *     the database — nothing is optimistically invented.
 *   - Removal stays a Server Action: it carries only an image id, and the
 *     existing action already revalidates the page.
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
  const router = useRouter();
  const [removeState, removeAction, removePending] = useActionState(
    removeGalleryImageAction,
    {},
  );
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{
    failed: boolean;
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    // Nothing chosen — say so instead of firing an empty request.
    const files = data
      .getAll("images")
      .filter((value): value is File => value instanceof File && value.size > 0);
    if (files.length === 0) {
      setUploadMessage({
        failed: true,
        text: "Choose at least one image to upload.",
      });
      return;
    }

    setUploading(true);
    setUploadMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/images`, {
        method: "POST",
        body: data,
      });
      const payload = (await response.json().catch(() => null)) as {
        info?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        setUploadMessage({
          failed: true,
          text: payload?.message ?? "The upload failed — try again.",
        });
        return;
      }

      setUploadMessage({
        failed: false,
        text: payload?.info ?? "Image added to the gallery.",
      });
      form.reset();
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Re-read the server-rendered list so the new rows come from the DB.
      router.refresh();
    } catch {
      setUploadMessage({
        failed: true,
        text: "ProLib could not be reached — try the upload again.",
      });
    } finally {
      setUploading(false);
    }
  }

  const message =
    uploadMessage?.text ??
    removeState.error ??
    removeState.info ??
    null;
  const failed = Boolean(uploadMessage?.failed ?? removeState.error);

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
                  src={image.path}
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
                  href={image.path}
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
        onSubmit={upload}
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
            ref={fileInputRef}
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
          disabled={uploading}
          leadingIcon={uploading ? "progress_activity" : "upload"}
        >
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </form>

      {message && (
        <Alert tone={failed ? "danger" : "success"}>{message}</Alert>
      )}
    </div>
  );
}
