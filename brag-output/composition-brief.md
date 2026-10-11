# Hyperframes Composition Brief: ProLib — College Project Library

## Objective
Create a short launch-style brag video for ProLib, a public college project archive
(GitHub-dark, Next.js 16 + Drizzle + Postgres), whose pitch is the product's own CTA:
"Don't let your semester project rot in a zip file."

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 22s (target window 15–25s)

## Source Material
- Project root: `/Users/arunrajv/Documents/projects/ProLib`
- Primary files read: `README.md`, `package.json`, `src/app/page.tsx`,
  `src/app/globals.css`, `src/lib/constants.ts` (SITE copy, project types),
  `src/components/home/Hero.tsx`, `Sections.tsx`, `Spotlight.tsx`,
  `src/components/dashboard/ProjectWizard.tsx`,
  `src/components/project/ProjectCard.tsx`,
  `src/app/projects/[slug]/page.tsx` (GitHub repository block)
- Product name: ProLib
- Tagline / strongest claim: "Discover what your college is building."
- Key UI or visual moment to recreate: the homepage hero (mono stream pill + headline
  + four campus metric tiles) and the two-minute create wizard ending in a Publish
  click; plus the GitHub repository block on a project page.
- Copy that must appear verbatim:
  - "Don't let your semester project rot in a zip file."
  - "Discover what your college is building."
  - "Built something worth sharing?"
  - "SPRING 2027 CAPSTONE ARCHIVE / v2.4.0-campus" (the pill; year is the
    current-academic-year instance value)
  - Metric labels: "Documented Projects", "Student Builders", "Active Tech Stacks",
    "Open Source Repos"
  - Wizard section headers: "THE ESSENTIALS", "COVER IMAGE", "STACK"
  - "Markdown & README import", "Gallery & architecture diagrams", "Team members with
    real profiles"
  - "GITHUB REPOSITORY" block with stars / forks / Languages

## Creative Direction
- Tone preset: `default`
- Creative direction: GitHub-dark terminal archive — dry campus humor, developer-tool
  precision, zero SaaS fluff
- Interpretation: fast snappy entrances and cuts carry the energy; typography and
  layout stay as restrained as the product (tonal layering, 1px borders, 6px radii,
  mono labels, no glow/glass).
- Angle: the film opens on the fate of every student project —
  `capstone_final_FINALv3.zip`, unopened since May — and shows ProLib doing the
  opposite: a two-minute form turning that zip into a published, faculty-approved,
  star-tracked project page.
- Hook: a monospace filename types itself out, a red `UNOPENED SINCE MAY` badge snaps
  on, then "Don't let your semester project rot in a zip file."
- Outro / punchline: "Built something worth sharing?" + the three check lines, then
  the ProLib wordmark and the tagline.
- Avoid:
  - Generic SaaS language ("streamline", "supercharge", "10x")
  - Abstract filler visuals, waveforms, equalizers, particles
  - Redesigning the product's look — tokens below are the contract

## Visual Identity
- Background: `#0d1117` (canvas), `#010409` (inset), `#161b22` (cards/subtle)
- Text: `#f0f6fc` (default), `#8b949e` (muted), `#6e7681` (subtle), borders `#30363d` /
  `#21262d`
- Accent: `#58a6ff`; primary button `#238636` (hover `#2ea043`); success `#3fb950`;
  attention `#d29922`; danger `#f85149`; done `#8957e5`
- Display font: Inter (bold, tight tracking) — hero/outro headlines
- Body font: JetBrains Mono for pills, labels, metrics, badges, counters
- Visual references from the project: hero metric strip (icon chip + big number with
  accent `+` + mono uppercase label), mono stream pill with green dot, 6px-radius
  bordered cards, `FEATURED CAPSTONE` / `Faculty Approved` badges, language bars,
  green primary Publish button.

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. The zip file — 4.2s — typed `capstone_final_FINALv3.zip`, red `UNOPENED SINCE MAY`
   badge, then the verbatim line "Don't let your semester project rot in a zip file."
2. The archive, live — 4.2s — hero pill, headline "Discover what your college is
   building.", four metric tiles arriving one by one with counters ticking up.
3. Two minutes to publish — 4.2s — the real wizard: "Project name" types
   `CampusRoute`, summary fills with the character counter ticking, type = Hackathon,
   stack chips drop in, cursor clicks the green Publish button.
4. It's live, with receipts — 4.4s — ProjectCard lands in the archive grid; the
   GitHub repository block reads `ceconline/campusroute`, `★ 128 stars · 17 forks`,
   language bars fill (TypeScript 78% / CSS 14% / Shell 8%); `FEATURED CAPSTONE` +
   `Faculty Approved` settle in.
5. Built something worth sharing? — 5.0s — contribute card with the three green-check
   lines arriving in succession, hold, then the ProLib wordmark + tagline +
   `v2.4.0-campus` pill.

Fictional stand-ins (the real database ships empty by design): all project content —
"CampusRoute", its summary, the owner "Anjali R. (CSE '27) + 2", stars/forks/views,
`ceconline/campusroute` — is plausible demo content, matching the product's real
structure and vocabulary. No real names, emails or data on screen.

## Audio
- Audio role: clean mid-energy bed with motion-matched UI accents — restrained,
  developer-tool polish
- Audio arc: quiet curiosity over the zip gag → bed lifts with the campus metrics →
  steady productivity through the publish click → payoff accent on the live repo
  block → quiet bell under the wordmark → fade out.
- Music: `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3`
- Music treatment: from 0s, volume ~0.32, fade in over ~0.5s, fade out over the last
  ~0.8s under the final wordmark frame. Never above 0.5.
- Music cue guidance: bundled preset
  `brag skill assets/music/cues/happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.json`
  (114.84 BPM). Strong cues: 4.23s, 8.44s, 12.65s, 23.17s. Planned major locks:
  scene 1→2 wipe at ~4.23s (beat-locked), scene 3 publish / scene 4 cut at ~12.65s
  (beat-locked), wordmark settle near a beat in the 20.5–21.0s region. Beat-grid
  windows: metric tiles on 4.75 / 5.28 / 5.80 / 6.34; tech chips on consecutive beats
  ~10.5–11.6s; check lines on consecutive beats ~18.9–20.0s. Cues are hints —
  readability and pacing win.
- Audio-reactive treatment: subtle; the pill's green dot and the hero metric panel's
  border/presence breathe slightly with music RMS. No waveform/equalizer visuals.
- Audio-coupled moments:
  - Scene 1 — per-character key ticks on the typed filename; soft drop on the badge.
  - Scene 2 — counter ticks on the four metrics; soft drops on tile arrivals
    (accent first and last).
  - Scene 3 — key ticks while typing, one drop per stack chip, one clear mouse click
    on Publish (land near 12.65s).
  - Scene 4 — card-place on the landing, soft bell on the star count, bars filling on
    the beat.
  - Scene 5 — soft drops on check lines, one quiet deep bell on the wordmark.
- SFX selection guidance: sparse-to-moderate (4–6 cues). Card sounds for card reveals,
  keyboard/keypress for typing, a clean click for Publish, one announcement-style cue
  for the wordmark. Match SFX timestamps to the first visible frame of each motion.
- SFX analysis guidance: read the brag skill's `assets/sfx/sfx-analysis.md` before
  choosing; prefer low/medium high-frequency-risk files for the repeated moments.
- Exact SFX choice: Hyperframes chooses filenames, timestamps, density and volume
  based on the implemented animation.
- Audio files: copy the chosen music and any selected SFX into
  `brag-output/composition/assets/`.

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core`,
`hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`,
`hyperframes-cli`. /brag is its own workflow: do not enter the `hyperframes`
entry-point intent interview and do not route into its generic promo / launch-video
workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project (hero,
  wizard and repo block above are all real UI recreations).
- Keep all text readable in the final render (short label ~0.8s settled, sentence
  ~0.3s/word).
- Keep the video within 15–25 seconds (22s planned).
- Include the planned music/SFX layer.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet; choose SFX after the
  visual animation exists.
- Treat music cue metadata as optional timing hints; 1–3 strong cue locks.
- Honor the music fade-in/fade-out treatment.
- Consider the audio-reactive workflow for the subtle treatment above; skip and note
  it if extraction is unavailable.
- Use local assets for audio.
- Run `hyperframes check` before render — it is brag's single gate.
- Keep creation and rendering local. Remote or publishing workflows require a separate
  explicit user request.
