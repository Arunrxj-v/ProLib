/**
 * Central constants for ProLib.
 *
 * Everything a student picks when creating a project is backed by a database
 * table (departments, categories, academic years, semesters, technologies).
 * The unions below describe what the *column* may legally hold; the editable
 * option lists live in the DB (admin taxonomy, plus technologies students type
 * in themselves on the create form). A fresh instance starts with them empty.
 */

export const PROJECT_TYPES = [
  { value: "academic", label: "Academic" },
  { value: "personal", label: "Personal" },
  { value: "hackathon", label: "Hackathon" },
  { value: "research", label: "Research" },
  { value: "open_source", label: "Open Source" },
  { value: "other", label: "Other" },
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number]["value"];

export const LIFECYCLE_STATUSES = [
  { value: "in_progress", label: "In Progress", tone: "attention" },
  { value: "completed", label: "Completed", tone: "success" },
  { value: "archived", label: "Archived", tone: "muted" },
] as const;

export type ProjectLifecycleStatus =
  (typeof LIFECYCLE_STATUSES)[number]["value"];

/**
 * Publishing workflow:
 *
 *   draft -> submitted -> in_review -> approved -> published
 *                         |
 *                         +-> rejected (back to the student, with a reason)
 */
export const PUBLICATION_STATUSES = [
  { value: "draft", label: "Draft", tone: "muted" },
  { value: "submitted", label: "Submitted", tone: "accent" },
  { value: "in_review", label: "In Review", tone: "attention" },
  { value: "approved", label: "Approved", tone: "success" },
  { value: "rejected", label: "Rejected", tone: "danger" },
  { value: "published", label: "Published", tone: "success" },
] as const;

export type ProjectPublicationStatus =
  (typeof PUBLICATION_STATUSES)[number]["value"];

/** Statuses that are visible in the public library. */
export const PUBLIC_PUBLICATION_STATUSES: ProjectPublicationStatus[] = [
  "approved",
  "published",
];

export const PROJECT_SECTION_KEYS = [
  { value: "overview", label: "Overview" },
  { value: "problem", label: "Problem" },
  { value: "solution", label: "Solution" },
  { value: "features", label: "Features" },
  { value: "technology", label: "Technology" },
  { value: "architecture", label: "Architecture" },
  { value: "challenges", label: "Challenges" },
  { value: "future", label: "Future Improvements" },
] as const;

export type ProjectSectionKey =
  (typeof PROJECT_SECTION_KEYS)[number]["value"];

export const ROLES = [
  { value: "student", label: "Student" },
  { value: "admin", label: "Administrator" },
] as const;

export type UserRole = (typeof ROLES)[number]["value"];
export type UserStatus = "active" | "suspended";

export const SOCIAL_PROVIDERS = [
  { value: "github", label: "GitHub", icon: "code" },
  { value: "linkedin", label: "LinkedIn", icon: "work" },
  { value: "instagram", label: "Instagram", icon: "photo_camera" },
  { value: "x", label: "X / Twitter", icon: "tag" },
  { value: "portfolio", label: "Portfolio", icon: "open_in_new" },
  { value: "youtube", label: "YouTube", icon: "smart_display" },
  { value: "other", label: "Other", icon: "link" },
] as const;

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]["value"];

export type ReportStatus = "open" | "resolved" | "dismissed";

/** Sort options on the discovery screens. */
export const PROJECT_SORTS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most liked" },
  { value: "views", label: "Most viewed" },
  { value: "trending", label: "Trending" },
] as const;

export type ProjectSort = (typeof PROJECT_SORTS)[number]["value"];

/** Upload contract enforced by /api/uploads. */
export const UPLOAD_RULES = {
  maxBytes: 4 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  allowedExtensions: ["jpg", "jpeg", "png", "webp", "avif"],
} as const;

export const PAGE_SIZE = 12;

/** Brand copy lifted from the supplied design. */
export const SITE = {
  name: "ProLib",
  tagline: "Discover what your college is building.",
  description:
    "Explore engineering capstones, research prototypes, and open source tools built by student engineers. Preserving campus innovation across batches with reproducible architecture and verified code.",
  edition: "CEC Archive",
} as const;
