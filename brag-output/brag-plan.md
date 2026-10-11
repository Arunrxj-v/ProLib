# Brag Plan: ProLib — College Project Library

## What is this app?

A public, GitHub-dark archive where a college's student work — capstones, research
prototypes, hackathon builds, open source tools — gets documented, published,
discovered and reviewed; built with Next.js 16 / React 19 / Drizzle / Postgres, and
refreshingly honest (real empty states, real GitHub metadata, no fabricated anything).

## The angle

**"Don't let your semester project rot in a zip file."** — the product's own CTA line
is the whole film. The video opens on the fate of every student project
(`capstone_final_FINALv3.zip`, unopened since May) and then shows ProLib doing the
opposite: a precise, archival, GitHub-dark library where a two-minute form turns that
zip file into a published, faculty-approved, star-tracked project page.

Specific to this project, not generic SaaS: every frame is built from ProLib's real
design tokens (`#0d1117` canvas, `gh-*` colors, 6px radii, mono labels, 1px borders,
no glow, no glass) and its real copy — the version pill, the four campus metrics, the
"THE ESSENTIALS" wizard sections, the GitHub repository block with real stars.

**Fictional stand-ins:** the database ships empty by design (no seed data), so all
project content shown (a campus shuttle tracker called "CampusRoute", its summary,
stars, owner) is plausible fictional stand-in content — no real student names, emails
or data anywhere on screen.

## Hook (first 2-3 seconds)

A single monospace line on the black canvas, typed out with key ticks:
`capstone_final_FINALv3.zip` — then a red `UNOPENED SINCE MAY` tag snaps on beside it.
The zip is every student's thesis, rotting. One line of copy underneath: **"Don't let
your semester project rot in a zip file."** Earns the next 20 seconds by naming the
exact pain this product kills, in the product's own words.

## Key moments (the middle)

- **The ProLib hero, live** — the academic stream pill (`● SPRING 2027 CAPSTONE
  ARCHIVE / v2.4.0-campus`), the headline "Discover what your college is building.",
  and the four campus metric tiles (Documented Projects / Student Builders / Active
  Tech Stacks / Open Source Repos) arriving one by one with counters ticking up.
- **The two-minute create form** — the real wizard sections ("THE ESSENTIALS",
  "COVER IMAGE", "STACK"): "Project name" types itself to `CampusRoute`, the
  character counter `42/500` ticks, tech chips drop in, then a cursor clicks the green
  **Publish** button. Entry → key action, exactly as the app does it.
- **It goes live** — the project card lands in the archive grid (type badge, cover,
  tech tags, owner row) next to the GitHub repository block reading
  `ceconline/campusroute · ★ 128 · 17 forks` with the language bars filling. Real
  numbers, never faked.

## Outro / punchline

The contribute card: **"Built something worth sharing?"** with the three check lines
(Markdown & README import / Gallery & architecture diagrams / Team members with real
profiles), then the wordmark **ProLib** and the tagline "Discover what your college is
building." — the zip file gag answered by the brand.

## User flow worth showing

Entry → key action → result, the real happy path:
1. **Entry** — homepage hero: pill, headline, campus metrics ticking up.
2. **Key action** — `/dashboard/projects/new`: type the name, write the summary, pick
   the stack, click Publish (moderation is off by default, so this really is one
   click).
3. **Result** — the project is public: card in the archive + project page with the
   live GitHub repo block (stars, forks, languages) and "Faculty Approved" provenance.

## Tone

- Preset: `default`
- Creative direction: GitHub-dark terminal archive — dry campus humor, developer-tool
  precision, zero SaaS fluff
- Interpretation: confident, quick, monospaced; energy comes from snappy cuts,
  sequential reveals and one genuinely funny opening image, while the typography and
  layout stay as restrained as the product (tonal layering, 1px borders, no glow).

## Format: landscape — 1920x1080

## Duration: 22s (scenes: 4.2 + 4.2 + 4.2 + 4.4 + 5.0)

## Visual identity (from the project)

- Background: `#0d1117` (gh-canvas), inset `#010409`, cards `#161b22`
- Accent: `#58a6ff` (gh-accent), primary button `#238636`, success `#3fb950`,
  attention `#d29922`, danger `#f85149`
- Text: `#f0f6fc` (fg-default), muted `#8b949e`, subtle `#6e7681`, borders `#30363d`
- Display font: Inter (bold, tight tracking) — headline weight for hero/outro
- Body font: JetBrains Mono for labels, pills, metrics, badges; Inter for prose
- Strongest visual element: the hero metric strip (4 inset tiles with icon chip,
  big number + accent `+`, mono uppercase label) and the mono version pill

## Share copy (draft)

Your semester project deserves better than a zip file named `final_FINALv3`. ProLib —
the open archive where a college's capstones, research and hackathon builds actually
get seen. Built with Next.js 16, Drizzle and Postgres.

## Audio direction

- Role: clean, upbeat-but-restrained bed with motion-matched UI accents — polished
  developer-tool energy, never noisy
- Music: `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` (mid-energy, slightly
  laid-back, 114.84 BPM — matches the dry wink of the hook)
- Music treatment: starts at 0, volume ~0.32, gentle fade-in over the first beat, out
  over the final 0.8s as the wordmark holds
- Music cue guidance: preset available at
  `<skill-dir>/assets/music/cues/happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.json`
  — strong cues 4.23s, 8.44s, 12.65s, 23.17s. Scene cuts placed at 4.2s / 8.4s /
  12.6s to land on 4.23 / 8.44 / 12.65 (±0.15s); metric tiles and tech chips snap to
  the half-beat grid 4.75 / 5.28 / 5.80 / 6.34. Beat-grid window 0–22s.
- Audio-reactive treatment: subtle — the pill's green dot and the metric panel's
  border presence breathe very slightly with RMS; the wordmark gets a soft accent on
  the final cue. No waveform/equalizer visuals.
- SFX posture: sparse-to-moderate (4-6 cues), motion-matched, professional restraint
- Audio-coupled moments: typing the zip filename (key ticks), the Publish click
  (mouse click), metric counters ticking, tech chips dropping in, the project card
  landing (card place), the star count arriving
- Restraint rule: nothing aggressive or comedic-loud — this is a precise tool, not a
  meme edit; no glitch or error sounds, no SFX on every beat

## Storyboard

### Scene 1 — The zip file — 4.2s
Black `#0d1117` canvas, faint inset panel. `capstone_final_FINALv3.zip` types out in
JetBrains Mono, character by character; a red `UNOPENED SINCE MAY` badge snaps on to
its right. Then the copy fades up beneath, Inter, with "rot in a zip file" in accent
blue: **"Don't let your semester project rot in a zip file."** No product UI yet —
just the wound.
Sequential/interaction: yes — filename types character by character, badge snaps in,
then the sentence fades up.
Audio intent: curiosity; dry, quiet, a little funny.
Audio-coupled idea: randomized keyboard keypress ticks on the typing; one soft drop
on the badge snap.
Music: bed at low volume, still establishing.
Transition mood: clean wipe right → Scene 2, timed on the 4.23s strong cue.

### Scene 2 — The archive, live — 4.2s
Recreation of the real homepage hero: mono pill `● SPRING 2027 CAPSTONE ARCHIVE /
v2.4.0-campus` lands first, then the headline **"Discover what your college is
building."** ("building." in accent), then the four campus metric tiles — Documented
Projects / Student Builders / Active Tech Stacks / Open Source Repos — arrive one by
one, each with its counter ticking from 0 to its number (e.g. 248 / 1,904 / 37 / 612)
and its colored icon chip (blue folder, green groups, amber terminal, blue source).
Sequential/interaction: yes — pill → headline → 4 tiles staggered ~0.4s apart on the
beat grid, each held to end of scene.
Audio intent: momentum building; the campus feels populated.
Audio-coupled idea: counter ticks; soft drop/plip per tile arrival (accent the first
and fourth only).
Music: bed lifts slightly, first strong accent at 6.34s as the last tile lands.
Transition mood: soft slide up → Scene 3, on the 8.44s strong cue.

### Scene 3 — Two minutes to publish — 4.2s
Recreation of the real create wizard `/dashboard/projects/new`: mono section headers
`THE ESSENTIALS`, then the "Project name" field types itself to **CampusRoute**; the
"Short description" field fills with "Real-time shuttle tracking for the north gate,
built at the 2026 hackathon." and its hint counter ticks `92/500 characters`; the
type select shows **Hackathon**; `STACK` chips drop in: Next.js, PostgreSQL,
Leaflet. A cursor glides to the green **Publish** button and clicks — the button
compresses and a green "Published" state flashes.
Sequential/interaction: yes — simulated typing, then chips dropping, then a cursor
click on Publish.
Audio intent: productivity, satisfaction; the tool is fast and honest.
Audio-coupled idea: key ticks during typing, drop sounds per chip, one clear mouse
click on Publish.
Music: steady; land the Publish click near the 12.65s strong cue.
Transition mood: hard cut to black edge → Scene 4, the payoff.

### Scene 4 — It's live, with receipts — 4.4s
The result: a ProjectCard lands into the archive grid (cover block, `HACKATHON`
badge, title **CampusRoute**, the same one-line summary, tech tags, owner row
"Anjali R. (CSE '27) + 2", `1.2k views · 84 likes`). Beside it, the real GitHub
repository block: header `GITHUB REPOSITORY`, link `ceconline/campusroute`, mono row
`★ 128 stars · 17 forks · Updated 3 days ago`, and language bars filling — TypeScript
78%, CSS 14%, Shell 8%. A small green `Faculty Approved` / `FEATURED CAPSTONE` badge
settles on the card.
Sequential/interaction: yes — card lands first, repo block slides in, counters and
language bars fill left to right.
Audio intent: payoff; real, verifiable, quietly proud.
Audio-coupled idea: card-place on the landing, a soft bell on the star count, bar
fills riding the beat.
Music: strongest section; the 12.65s cue carries the cut in.
Transition mood: soft crossfade → Scene 5.

### Scene 5 — Built something worth sharing? — 5.0s
The real contribute card: mono `OPEN ACADEMIC ARCHIVE` pill, headline **"Built
something worth sharing?"**, the product's own subcopy (trimmed to one line), and the
three check lines arriving in quick succession: `Markdown & README import`,
`Gallery & architecture diagrams`, `Team members with real profiles` — each with a
green check. They hold ~1.6s as a set. Then everything settles away and the final
frame resolves: **ProLib** wordmark, the tagline "Discover what your college is
building.", and the `v2.4.0-campus` pill echoing the opening.
Sequential/interaction: yes — pill → headline → three check lines (0.3s stagger) →
hold → final wordmark card.
Audio intent: warm close; the joke lands and the brand takes the frame.
Audio-coupled idea: soft drops on the check lines, one deep but quiet bell on the
wordmark (the 23.17s cue region, pulled to ~20.5s within tolerance or the nearest
beat).
Music: bed fades out under the last 0.8s.
Transition mood: none — final frame holds to 22.0s.

**Music mood for this video:** upbeat, mid-energy, dry-clean (vol-9).
**Audio summary:** quiet curiosity over the zip gag → a bed that lifts with the
campus metrics → steady productivity through the publish click → the payoff accent on
the live repo block → a warm, quiet bell under the wordmark.
