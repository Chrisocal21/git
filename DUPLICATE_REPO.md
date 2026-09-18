# Duplicate Repo Handoff — De-Branded Personal/Family Fork

**For:** Claude (in a new session/repo)
**From:** Chris
**Date:** 2026-09-09

---

## 1. What This Is

The source project is **"burrow"** — a personal ops tool originally built as *"a companion tool for Swanky event pros"* (Swanky = Chris's employer). It manages job trips, events, and communications for on-site laser engraving work.

Chris wants a **complete duplicate of this codebase**, deployed as a **separate app**, with:
- All references to the old branding (**"burrow"**, **"Swanky"**, the badger mascot copy) **removed**
- A **fresh, empty database** — none of the old work/job history should carry over
- **New hosting + new API keys** — this must be a fully independent deployment, not sharing infrastructure with the original
- The app repurposed for **personal use between Chris and his family** (not work/client job tracking)

This is a **fork + rebrand + reset**, not an account migration. (There's an existing [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md) in this repo, but that guide is for moving the *same* app with its *same* data to new accounts — that is NOT what we want here. Do not follow that guide's "export/import D1 data" steps; the family version starts with a clean database.)

---

## 2. Tech Stack (unchanged)

| Component | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Hosting | Vercel |
| Database | Cloudflare D1 |
| AI | OpenAI API (message polish / wrap-up features) |
| Maps | Google Maps JavaScript + Places API |
| Weather | OpenWeather API |
| Auth | Simple shared PIN (server-verified via `APP_PIN` env var) |

All of this can be reused as-is — same stack, new accounts/keys/database (see Section 5).

---

## 3. Step-by-Step Build Order

1. **Copy the codebase** into a new GitHub repo (new name — see Section 4.1). Fresh git history is fine (a single "initial commit" is cleaner than carrying over Chris's work-related commit log).
2. **Rebrand** every reference listed in Section 4 — new app name, new tagline, new PIN storage key prefix, new icons/favicon.
3. **Decide on scope changes** for family use (Section 6) — keep, rename, or strip the job/client-specific fields.
4. **Create fresh accounts/resources** (Section 5): new Vercel project, new Cloudflare D1 database (empty schema, no data import), new API keys for OpenAI/Google Maps/OpenWeather.
5. **Set environment variables** in the new Vercel project (Section 5.4) — do not reuse any of the original project's keys or tokens.
6. **Deploy and verify**: PIN screen works, can create/edit a folder, maps load, weather loads, AI polish works, D1 persists across refresh/redeploy.
7. **Read the security note in Section 7 before touching the original repo's `.env` or `D1_SETUP.md` files** — do not copy their contents into the new repo.

---

## 4. Branding to Remove/Replace

### 4.1 App name & identity
Pick a new name (family should choose — e.g. something personal/inside-joke, not tied to "burrow" or any employer branding). Wherever "burrow"/"Burrow" appears below, replace with the new name. Wherever "Swanky" appears, replace with a family-appropriate tagline or remove entirely.

### 4.2 Exact locations to change

| File | What's there now | Change to |
|---|---|---|
| [package.json](package.json) | `"name": "burrow"` | new package name |
| [public/manifest.json](public/manifest.json) | `"name": "burrow"`, `"short_name": "burrow"`, `"description": "A companion tool for Swanky event pros"` | new name/short_name/description |
| [src/app/layout.tsx](src/app/layout.tsx) | `metadata.title: 'burrow'`, `description: 'A companion tool for Swanky event pros'`, `appleWebApp.title: 'burrow'` | new title/description everywhere |
| [src/app/about/page.tsx](src/app/about/page.tsx) | Headings "Burrow", "Why Burrow?", copy: *"Because a badger needs its burrow to collect its stuff... Burrow is one place to keep it all... Like a badger's burrow."* | Rewrite this whole page's copy — new name, new "why this exists" story (family-oriented, not badger/job themed) |
| [src/app/how-to/page.tsx](src/app/how-to/page.tsx) | `"How to Use Burrow"` heading | new name |
| [src/app/jobs/page.tsx](src/app/jobs/page.tsx) | Two `"Burrow"` headings | new name (also consider renaming the `/jobs` route itself — see Section 6) |
| [src/app/jobs/create/page.tsx](src/app/jobs/create/page.tsx) | `"Burrow"` heading | new name |
| [src/components/PinScreen.tsx](src/components/PinScreen.tsx) | `"burrow"` heading, `PIN_STORAGE_KEY = 'burrow-pin-auth'` | new name, new storage key (e.g. `<newname>-pin-auth`) |
| [src/components/PinAuthWrapper.tsx](src/components/PinAuthWrapper.tsx) | `PIN_STORAGE_KEY = 'burrow-pin-auth'` | must match the key used in PinScreen.tsx |
| [src/components/MenuButton.tsx](src/components/MenuButton.tsx) | `NOTES_KEY = 'burrow-quick-notes'`, removes `'burrow-pin-auth'` from storage on logout, footer text `"Burrow · Companion for Swanky"` | new storage keys (must match everywhere), new footer text |
| [README.md](README.md) | `# burrow`, `"A companion tool for Swanky event pros - Manage your job trips, events, and communications."` | rewrite for the new project |
| [PROJECT.md](PROJECT.md) | Extensive — title, tagline "Where you keep your sh*t organized", "For a production manager who travels for on-site laser engraving jobs", tone profile references to "Chris" specifically as a solo work tool | Treat as a historical design doc for the *original* app — either archive it or rewrite the overview section if you want an equivalent handoff doc for the family app |
| [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md) | References `burrow-db` as an example database name | Not required for this fork, but if kept, rename example references |

### 4.3 Visual assets

| File | Current | Action |
|---|---|---|
| [public/favicon.svg](public/favicon.svg) | Gold "B" monogram (`#E8B44D`) | Replace with new initial/icon |
| [public/icon-192.png](public/icon-192.png), [public/icon-512.png](public/icon-512.png), matching `.svg` versions | Same "B" branding, likely burrow/badger themed | Regenerate for new name |
| [src/app/globals.css](src/app/globals.css) | `--accent: #3b82f6` (blue, used broadly), gold `#E8B44D` used as an accent in headings on About/How-To/Jobs pages | Optional — colors aren't tied to the "Swanky" brand specifically, but pick whatever palette the family prefers |

### 4.4 Search-and-verify

After making changes, do a final case-sensitive grep across the repo for `burrow`, `Burrow`, and `Swanky` to confirm nothing was missed — these three strings should return zero results outside of this handoff doc and any historical `PROJECT.md` you choose to keep as an archive.

---

## 5. New Infrastructure (do NOT reuse the original's)

### 5.1 GitHub repo
Create a new repo under whatever account the family will use. Do not push to `Chrisocal21/git` (the original repo).

### 5.2 Vercel project
New Vercel project, connected to the new repo. Do not add this as a new deployment/domain on the existing Vercel project.

### 5.3 Cloudflare D1 database
Create a **brand-new, empty** D1 database — do not export/import data from the original. Apply the schema from [schema.sql](schema.sql) (and [schema-field-guide.sql](schema-field-guide.sql) if relevant) to the new database. The family app should start with zero folders/jobs in it.

### 5.4 Environment variables (new values for every one of these — see Section 7 before copying anything from the original `.env`)

| Variable | Purpose | Where to get a new one |
|---|---|---|
| `APP_PIN` | Shared PIN for app access | Pick a new PIN the family will use |
| `OPENAI_API_KEY` | AI message polish / wrap-up features | https://platform.openai.com/api-keys (new key, or reuse only if Chris is fine sharing billing — his call) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Address autocomplete, maps | https://console.cloud.google.com/google/maps-apis/credentials — new key, restrict to the new Vercel domain |
| `NEXT_PUBLIC_OPENWEATHER_API_KEY` | Weather forecasts | https://home.openweathermap.org/api_keys |
| `D1_ENABLED` | Set to `true` | — |
| `CLOUDFLARE_ACCOUNT_ID` | New D1 database's account | Cloudflare dashboard |
| `CLOUDFLARE_DATABASE_ID` | New D1 database's ID | Output of `wrangler d1 create` |
| `CLOUDFLARE_API_TOKEN` | New D1 database's access token | Cloudflare dashboard → API Tokens (scoped to D1 edit) |

Reference [.env.example](.env.example) for the full list/format — it already contains only placeholders, safe to copy as a template.

---

## 6. Functional Scope — Decide What Changes for Family Use

The app's core data model (a "Fldr" = flexible folder for a trip/event, see [PROJECT.md](PROJECT.md) Section 5) already supports two use patterns: work trips (with client/job fields) and personal events (checklist + people, no job fields). For a family app, the job-specific fields are probably dead weight. Options, roughly in order of effort:

1. **Do nothing functionally** — just rebrand. The unused `job_info` module (client name, job type, "caricatures"/"names_monograms" enum, etc.) just never gets used by the family. Fastest option.
2. **Relabel navigation** — rename the `/jobs` route and "Fldr" terminology to something family-friendly (e.g. "Trips" or "Plans"), while keeping the same underlying data structure.
3. **Trim the schema** — remove the `job_info` module and the `job_type` enum entirely, since laser-engraving-specific fields (caricatures, client contact, pre-engrave details) have no meaning for a family trip planner.

Recommendation: start with option 1 or 2 for speed, revisit trimming later if the unused fields cause UI clutter. This is Chris's call, not a hard requirement — flag it to him if it's ambiguous which option he wants.

The **Write mode tone profile** (see PROJECT.md Section 7) is tuned to Chris's professional voice for work wrap-ups — it may not fit casual family messages. Consider whether Write mode is even wanted in the family version, or whether the tone profile should be loosened/removed.

---

## 7. Security Note — Read Before Copying Any Config

[D1_SETUP.md](D1_SETUP.md) in the original repo has a live-looking Cloudflare API token and account/database IDs written directly into the markdown (not just `.env.example` placeholders). **Do not copy that file's contents into the new repo.** This is a pre-existing issue in the original project unrelated to this fork — worth flagging to Chris separately so he can rotate that token if it's still valid, since it's sitting in git history. For the new repo, only ever put real secrets in `.env`/`.env.local` (which are gitignored) or in Vercel's environment variable settings — never in a committed `.md` file.

---

## 8. Quick Checklist

- [ ] New GitHub repo created, code copied over
- [ ] All "burrow"/"Burrow"/"Swanky" references replaced (Section 4)
- [ ] New name/tagline decided and applied everywhere, including PWA manifest and PIN storage keys
- [ ] New favicon/icons created
- [ ] New Vercel project created (not added to existing project)
- [ ] New empty Cloudflare D1 database created, schema applied, zero data imported from original
- [ ] All new API keys generated (OpenAI, Google Maps, OpenWeather, Cloudflare) — none reused from original
- [ ] Environment variables set in new Vercel project
- [ ] Decided on Section 6 scope questions (job fields, tone profile, route naming)
- [ ] Deployed and verified: PIN login, create/edit folder, maps, weather, AI polish, D1 persistence
- [ ] Confirmed the leaked token in D1_SETUP.md is not carried into the new repo, flagged to Chris for rotation
