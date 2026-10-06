/**
 * Reasons a visitor can pick when flagging a project.
 *
 * Pure data — safe to import from server code and from the client form.
 * The list is not stored in the database because it is part of the product
 * copy (the *reports* it produces are rows in `reports`).
 */

export const REPORT_REASONS = [
  {
    value: "spam",
    label: "Spam or misleading",
    hint: "Unrelated, deceptive, or pure advertising.",
  },
  {
    value: "misattributed",
    label: "Wrong author or team",
    hint: "Credit goes to someone who did not build it.",
  },
  {
    value: "plagiarism",
    label: "Plagiarism",
    hint: "Copied from another student, paper or repository.",
  },
  {
    value: "copyright",
    label: "Copyright or licence",
    hint: "Uses material the team is not allowed to share.",
  },
  {
    value: "inappropriate",
    label: "Inappropriate content",
    hint: "Harassment, unsafe content or personal data.",
  },
  {
    value: "other",
    label: "Something else",
    hint: "Describe the problem in your own words.",
  },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

const REASON_VALUES = REPORT_REASONS.map((reason) => reason.value);

export function isReportReason(value: string): value is ReportReason {
  return (REASON_VALUES as readonly string[]).includes(value);
}

export function reportReasonLabel(value: string): string {
  return REPORT_REASONS.find((reason) => reason.value === value)?.label ?? value;
}
