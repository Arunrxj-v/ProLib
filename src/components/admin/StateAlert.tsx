import { Alert } from "@/components/ui/Panel";

type Feedback = {
  error?: string;
  info?: string;
};

/**
 * Renders the result of a server action: errors announce themselves
 * (`role="alert"`), confirmations are polite (`role="status"`).
 */
export function StateAlert({ state, className }: { state: Feedback; className?: string }) {
  if (state.error) {
    return (
      <Alert tone="danger" className={className}>
        {state.error}
      </Alert>
    );
  }
  if (state.info) {
    return (
      <Alert tone="success" className={className} title={state.info} />
    );
  }
  return null;
}
