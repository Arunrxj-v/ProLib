# ProLib — College Project Library

A public archive where a college's student projects are published, discovered and
reviewed. Visitors browse and search without an account; students publish their
own work; administrators can moderate what goes live.

Built with **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 ·
Drizzle ORM · PostgreSQL (postgres-js)** — one Next.js service on `:3000`
serves both the UI and the REST API.

The visual language is extracted from the supplied Stitch design
(`prolib_homepage_github_dark`): GitHub-dark canvas (`#0d1117`), `gh-*` colour
tokens, 6px radii, no shadows or gradients beyond the design's image overlay.
Tokens live in `src/app/globals.css`; every screen is composed from the shared
primitives in `src/components/ui/`.

---

## Quick start

```bash
npm install
cp .env.example .env.local      # DATABASE_URL, AUTH_SECRET, OAuth keys — see below
docker compose up -d db         # local PostgreSQL 17 (persistent volume `prolib-pgdata`)
npm run db:migrate              # applies drizzle/ SQL migrations — explicit, never automatic
npm run dev                     # http://localhost:3000 (UI + REST API)
```

`DATABASE_URL` defaults to `postgres://prolib:prolib@127.0.0.1:5432/prolib`,
which matches the `db` service in `docker-compose.yml` — zero configuration
for local work. Migrations are **never** run at application boot (§29): the
schema changes only when you run `npm run db:migrate` (the Docker app image
runs it in its command before `npm start`).

**The database starts empty and stays empty until real people use it.** There is
no seed script, no demo accounts and no auto-generated content — an empty
database renders an empty (but fully functional) ProLib. Every screen ships a
real empty state: "No projects yet / Be the first to add your project", "No
student profiles yet / Create your profile", and so on.

### Create the first administrator

Admins are never created automatically. Bootstrap one from the CLI:

```bash
npm run create-admin -- admin@prolib.edu "Your Name" adminhandle 'Str0ngPass!'
```

The account is created with a verified email and the `admin` role; sign in
normally at `/login` afterwards.

### Database commands

| Command | Effect |
| --- | --- |
| `npm run db:generate` | Generate migrations from schema changes. |
| `npm run db:migrate` | Apply generated migrations to `DATABASE_URL`. Never runs on boot. |
| `npm run create-admin -- …` | Create an admin account (see above). |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

---

## Environment variables

All optional — the app runs fully local with zero configuration. Copy
`.env.example` to `.env.local`; secrets never enter Git (`.env*` is ignored,
`.env.example` has blank values only).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Defaults to `postgres://prolib:prolib@127.0.0.1:5432/prolib` (matches `docker-compose.yml`). Also read by `drizzle.config.ts`. |
| `AUTH_SECRET` | Peppers every session/token digest. **Required in production** — the app refuses to start without it. Dev falls back to a fixed local secret. Generate: `openssl rand -hex 32`. |
| `NEXT_PUBLIC_APP_URL` / `APP_URL` | Absolute URL base used in metadata and email links. Defaults to `http://localhost:3000`. |
| `API_URL` / `FRONTEND_URL` | Optional aliases for server-side absolute URL helpers. |
| `STORAGE_DIR` (`STORAGE_PATH`) | Root for uploads. Defaults to `./storage` (files land in `storage/uploads/**`). |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Enables **Connect GitHub** OAuth (dashboard → profile). Register an OAuth App with callback `{APP_URL}/api/github/callback` (or set `GITHUB_CALLBACK_URL`). Without them the UI says "not configured" honestly and the manual repository-URL field keeps working. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Enables the Google sign-in button (callback `{APP_URL}/api/auth/callback/google`, or `GOOGLE_CALLBACK_URL`). Without them `/api/auth/google` redirects to `/login?error=google_disabled` and the button is hidden. |
| `ALLOWED_COLLEGE_EMAIL_DOMAINS` | College email domains Google sign-in accepts (comma-separated; this instance: `ceconline.edu`). Required alongside the Google credentials — blank hides the button. The callback checks the **verified Google address** server-side, so personal domains (`gmail.com`, …) get a clear rejection and never create a user or session. Email + password sign-in is unaffected. |
| `RESEND_API_KEY` | Enables real verification emails via Resend. |
| `EMAIL_FROM` | From-header for those emails. |

Token scope: the GitHub access token is stored only in `github_accounts.
accessToken`, never sent to the client, and only used to list the student's own
repositories and read public repository metadata.

---

## Roles and authorization

| Capability | Visitor | Student | Admin |
| --- | :-: | :-: | :-: |
| Browse, search, filter, read public profiles | ✅ | ✅ | ✅ |
| Submit a report on visible content | ✅ | ✅ | ✅ |
| Create / edit / delete own projects, gallery, team | ❌ | ✅ | ✅ |
| Publish / unpublish own work | ❌ | ✅ | ✅ |
| Approve / reject / publish others' work | ❌ | ❌ | ✅ |
| Manage students, taxonomy, settings, reports | ❌ | ❌ | ✅ |

Enforcement is **server-side and re-checked on every action**:

- `src/proxy.ts` — cookie-presence gate: anonymous `/dashboard*` and `/admin*`
  → `302 /login?next=…`; a signed-in non-admin hitting `/admin*` → `307
  /dashboard?denied=1`.
- `src/app/admin/layout.tsx` — `requireAdmin()` around the whole console.
- Every server action re-runs its own guard (`ownedProject()`, `requireAdmin()`)
  before touching data. A non-owner asking for someone else's edit page gets a
  **404**, not a 403 (existence is not leaked).
- Public pages only reveal projects in a publicly visible status; everything
  else resolves to `notFound()`.

### Publishing workflow

**Moderation is OFF by default** (`Admin → Settings` can enable it), so a fresh
instance publishes instantly:

- **Create flow (~2 minutes):** title, one-line summary (≤500 chars), project
  type, technologies, one cover image — that's the required set. GitHub
  repository, live demo, screenshots and team are optional. Long write-ups live
  only on the Edit page, as optional extras.
- **Publish** requires only a title (≥4 chars) and a summary (≥20 chars);
  everything else is honest UI (a project without a cover simply shows no cover).
- **Save draft → Publish** is one click from the create form (`intent`
  button); **Unpublish** returns it to draft. Ownership is enforced
  server-side — only the owner edits by default.
- With **moderation enabled**, the same buttons become **Submit for review** /
  **Recall to draft**, and only `approved` / `published` work is publicly
  visible. Admins approve only from `submitted` / `in_review` / `rejected`,
  rejection requires a reason, and every decision writes an `audit_logs` row.

---

## Data model

`src/lib/db/schema.ts` (20 tables):

```
users ─ social_links ─ github_accounts   departments ─┐
  │ ─ sessions                            categories ┤
  │ ─ verification_tokens                 academic_years ─ semesters
  │ ─ audit_logs                          technologies ─ project_technologies
  ├─ project_members ─┐
  ├─ project_likes    ├─ projects ─ project_sections
  └─ reports          │            ─ project_images
                      │            ─ github_repositories (repo associations)
                      └──────────── ─ settings (platform key/value)
```

Teams are real relations: a project has many `project_members`, each pointing at
a `users` row with a role and an `isOwner` flag. Removing the owner is refused.
The team picker searches **real ProLib accounts** through `GET /api/students?q=`
— with an empty database it honestly answers "No other ProLib users yet."

### Search

PostgreSQL full-text search: generated `search_document` tsvector columns with
GIN indexes (`drizzle/0001_search.sql`), queried with prefix `to_tsquery` and a
`LIKE` fallback when the index is absent. `/api/search?q=…` returns projects,
students and technologies; the `/search` page renders the same three groups.
Explore filters (department, batch, type, technology, status, sort) query the
same real tables — no cached or fabricated counts anywhere.

### Uploads

Uploads go through server actions (`saveUpload`) and are validated **on the
server**: `jpg/jpeg/png/webp/avif`, max 4 MB, randomised filenames under
`storage/uploads/<scope>/<bucket>/`, served by `/uploads/[...path]` with a
sandboxed SVG CSP. Files outside that root are never written or deleted.

### GitHub integration

GitHub does the heavy lifting, and never fabricates anything:

- **Connect** (`/api/github/connect`) starts a real OAuth flow; the callback
  upserts one `github_accounts` row per user and stores identity (login, avatar,
  id) plus the token. When OAuth isn't configured, every endpoint answers an
  honest `501` and the UI explains what to set.
- **Repository picker** (`/api/github/repositories`, alias `/api/github/repos`)
  lists the account's real repositories with search; the manual URL field is a
  first-class fallback, and project creation is never blocked on GitHub.
- **Repository associations** (`github_repositories`): when a project stores a
  GitHub URL, `owner/name/url/description` are cached in a local row
  (`GET /api/github/repositories/:id`, optional `?refresh=1` for the linking
  user). GitHub stays the source of truth — `fetchedAt: null` honestly means
  "never fetched".
- **Repository block** on the project page fetches live public metadata
  (`/api/github/repo`) — real stars, forks and language percentages, with
  explicit `not_found` / `rate_limited` / `unreachable` states instead of
  invented numbers.
- Stored URLs are validated as absolute `http(s)` links; an empty field renders
  nothing rather than a dead icon. Social icons only appear when a
  `social_links` row exists.

---

## REST API

All endpoints are JSON served by the same Next.js process on `:3000`. Errors
always use `{ "error": <category>, "message": <detail> }` (plus `fieldErrors`
on validation failures) with proper status codes — never an HTML error page.
Auth is a server-side session in an httpOnly cookie; the browser never holds
auth state of its own.

### Auth

| Endpoint | Notes |
| --- | --- |
| `GET /api/auth/login` | Lists the sign-in providers this instance actually has. |
| `GET /api/auth/me` | `{authenticated:true, user:{id,name,email,…}}` or `{authenticated:false}` — always answers, never leaves a client waiting (§27). |
| `POST /api/auth/logout` | Destroys the session and clears the cookie (idempotent). |
| `GET /api/auth/google` | Starts the Google OAuth flow. |

### Users and students

| Endpoint | Notes |
| --- | --- |
| `GET /api/users/me` | Signed-in profile + social links (401 when anonymous). |
| `PATCH /api/users/me` | Partial profile update — JSON, or multipart with an `avatar` file; optional `socials: [{provider, url}]`. |
| `GET /api/users/:id` | Public profile (404 for missing or suspended accounts). |
| `GET /api/students?q=&department=&page=&limit=` | Directory straight from PostgreSQL; empty DB → `items: []`, `directoryCount: 0`. |

### Projects

| Endpoint | Notes |
| --- | --- |
| `GET /api/projects?q=&department=&technology=&type=&year=&status=&page=&limit=` | Public statuses only; search, filters and pagination all server-side. |
| `POST /api/projects` | multipart (cover file) or JSON (`cover_image` as a data URI); required: name, summary, type, technologies, cover. Owner always = session user. |
| `GET /api/projects/:id` | Slug **or** UUID; drafts resolve 404 for everyone else. |
| `PATCH /api/projects/:id` | Owner/admin only — 403 for other students, 404 for invisible drafts; partial fields, `publish: true\|false` drives the moderation-aware workflow. |
| `DELETE /api/projects/:id` | Owner/admin only; cover and gallery files are removed with the row. |
| `POST /api/projects/:id/members` | `{username \| user_id, role?}` — real accounts only, never free text. |
| `DELETE /api/projects/:id/members/:userId` | Owner/admin; the owner row can never be removed (409-class conflicts reported honestly). |
| `POST /api/projects/:id/images` | multipart screenshots (`images`/`image`/`file`). |
| `DELETE /api/projects/:id/images/:imageId` | Removes the row **and** the file. |

### GitHub

| Endpoint | Notes |
| --- | --- |
| `GET /api/github/status` | `{configured, signedIn, connected, identity}` — honest config state. |
| `GET /api/github/repositories?q=` (alias `/api/github/repos`) | The signed-in student's real repositories; 401 + `connected:false` when not connected. |
| `GET /api/github/repositories/:id` | Stored association; `?refresh=1` re-reads live metadata for the linking user or an admin. |
| `GET /api/github/repo?owner=&name=` | Public repository metadata or an explicit `available: false`. |

Ownership is enforced server-side on every mutation: the REST layer and the
dashboard forms call the same shared services (`src/lib/projectService.ts`,
`src/lib/userService.ts`), so the two surfaces can never disagree (§14).

---

## Docker (local development only)

`docker-compose.yml` runs PostgreSQL plus an optional app image (built from
`Dockerfile`), with a persistent `prolib-pgdata` volume and a bind-mounted
`./storage` so uploads survive restarts:

```bash
docker compose up -d db      # database only — the normal development setup
docker compose up --build    # database + app (the app command runs migrations first)
```

This stack is **local only** — it is not deployed, exposed or put behind a
domain; that is a later stage.

---

## Feature map

**Public** — `/` (design homepage), `/explore` (search + department / batch /
type / status / technology / sort filters, paginated), `/projects/[slug]`
(cover, short description, tech tags, About, gallery, team, GitHub repo block,
links), `/students` and `/students/[username]`, `/categories`,
`/technologies`, `/search`.

**Auth** — `/signup` (name, handle, email, password + optional department and
graduation year), `/login`, `/verify-email` (`?email=` resends, `?token=`
consumes a single-use 24h token). Unverified accounts cannot sign in and are
offered a resend. Passwords are scrypt-hashed; sessions are DB-backed rows whose
SHA-256 digest rides in an httpOnly `prolib_session` cookie. Google OAuth is the
primary social sign-in; GitHub OAuth links an identity to the existing account
(never a duplicate).

**Student dashboard** — `/dashboard`, `/dashboard/projects` (status tabs),
`/dashboard/projects/new` (the 2-minute create form), 
`/dashboard/projects/[id]/edit` (details, sections, cover, gallery, tech stack,
team, publish actions), `/dashboard/profile` (name, department, batch required;
photo, bio, GitHub, LinkedIn, portfolio, socials optional; **Connect GitHub**
panel), `/dashboard/notifications`.

**Admin** — `/admin` (overview), `/admin/projects` + `/admin/projects/[id]`
(review queue and decision forms), `/admin/students`, `/admin/reports`,
`/admin/taxonomy` (departments, categories, academic years, semesters,
technologies — with usage pre-checks before delete), `/admin/settings`.

**Reporting** — `/report/[slug]` is publicly reachable for anything the viewer
can already see (invisible projects 404 the same as missing ones), with zod
validation, open-report dedupe and a rate limit.

### UI states

Every list has a loading state (`loading.tsx` on `/explore`, `/search`,
`/categories`, `/technologies`, an inner `<Suspense>` skeleton on `/students`),
plus empty and error states (`error.tsx` uses a client-side reload, never
`window` during render). `/projects/[slug]` and `/students/[username]`
deliberately have **no** route-level `loading.tsx`: a parent boundary commits a
200 before `notFound()` resolves, which would break their 404 contract.

### Accessibility

Skip-to-content link, `<main id="main-content">` landmark, visible
`:focus-visible` outlines, `Field` label/`htmlFor` pairing (implicit wrapping
for radios and checkboxes), `aria-label` on every icon-only control, decorative
icons `aria-hidden`, `role="alert"` on inline field errors, and a global
`prefers-reduced-motion` override.

---

## Project structure

```
src/
  actions/          server actions (auth, projects, admin, report)
  app/              routes: (public), dashboard/, admin/, api/
  components/
    ui/             design system: Panel, Form, Button, Tag, Avatar, Icon, Navigation
    home/ project/ student/ layout/ dashboard/ admin/ report/
  lib/
    auth/           session, guards, google, verification, password, tokens
    data/           query layer (projects, students, search, admin, filters)
    validation/     zod contracts shared by client forms and server
    db/             drizzle client + schema (20 tables, postgres-js)
    api.ts          REST error contract + auth/ownership guards for routes
    projectService.ts  shared project mutations (forms + REST call this)
    userService.ts  shared profile mutation (form + PATCH call this)
    github.ts       GitHub OAuth, public repo metadata, repo association
    githubApi.ts    shared /api/github/repositories handler
    storage.ts      upload driver
    mail.ts         email transport boundary
    settings.ts     platform settings (moderation etc.) with honest defaults
drizzle/            SQL migrations (explicit `npm run db:migrate`)
```

### Email boundary

`src/lib/mail.ts` never fakes a delivery: with `RESEND_API_KEY` it sends for
real; without one, non-production prints the verification link to the server
console (and hands it back as `devLink` so signup can continue); in production
without a transport it reports `delivered: false` and tells the user to contact
an administrator.

---

## Quality gates

```bash
npm run lint        # 0 errors
npm run typecheck   # clean
npm run build       # production build
```
