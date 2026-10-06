-- Full-text search: generated tsvector documents + GIN indexes.
-- Generated columns recompute automatically on INSERT/UPDATE, so the index
-- can never drift out of sync (no triggers). Query layer: src/lib/data/internal.ts
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "search_document" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("short_description", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("description", '')), 'C')
) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_search_document_idx" ON "projects" USING gin ("search_document");
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "search_document" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("username", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("headline", '')), 'C') ||
  setweight(to_tsvector('english', coalesce("bio", '')), 'C')
) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_search_document_idx" ON "users" USING gin ("search_document");
