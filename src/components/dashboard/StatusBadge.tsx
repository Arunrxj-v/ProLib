import { PUBLICATION_STATUSES, type ProjectPublicationStatus } from "@/lib/constants";
import { Badge, type BadgeTone } from "@/components/ui/Tag";

const TONES: Record<ProjectPublicationStatus, BadgeTone> = {
  draft: "muted",
  submitted: "accent",
  in_review: "attention",
  approved: "success",
  rejected: "danger",
  published: "success",
};

/** Publication status pill — same wording the moderators see. */
export function StatusBadge({
  status,
  className,
}: {
  status: ProjectPublicationStatus;
  className?: string;
}) {
  const label = PUBLICATION_STATUSES.find((item) => item.value === status)?.label;
  return (
    <Badge tone={TONES[status]} dot className={className}>
      {label ?? status}
    </Badge>
  );
}
