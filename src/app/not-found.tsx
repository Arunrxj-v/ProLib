import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Panel";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <EmptyState
        icon="search_off"
        title="This page is not in the archive"
        description="The project, student or page you were looking for may have been removed, made private, or the link is out of date."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <LinkButton href="/explore" variant="primary" trailingIcon="arrow_forward">
              Browse projects
            </LinkButton>
            <LinkButton href="/" variant="default">
              Go home
            </LinkButton>
          </div>
        }
      />
    </div>
  );
}
