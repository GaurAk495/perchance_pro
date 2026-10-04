# Auto Perchance Pro — Extension Documentation

Bulk image generation automation for the Perchance image generator
(`https://perchance.org/image-generator-professional`).

- Manifest V3 Chrome Extension (v2.0.0)
- Written in TypeScript, built with Bun
- Free + Premium (freemium) model with Google sign-in and paid upgrade
- Front-end: Chrome side panel UI · Backend: Vercel serverless (`backend/`)

---

## Repo Layout

```
perchance_pro/
├── Extension.md          ← this file
├── ext/                  Chrome Extension (MV3)
│   ├── manifest.json
│   ├── src/
│   │   ├── background/   Service worker: orchestration, downloads, billing gating
│   │   ├── content/      Content script: DOM automation on perchance.org
│   │   ├── sidebar/      Side panel UI (HTML/CSS/TS, no framework)
│   │   ├── auth/         Google sign-in, Firebase, premium status
│   │   └── shared/       Constants, types, messages, prompt parsing, utils
│   ├── public/           Icons
│   └── dist/             Build output (sidepanel + manifest + packaged crx/zip)
└── backend/              Vercel serverless backend (payments + premium grants)
    └── api/              pricing.js, createOrder.js, webhook.js, status.js
```

---

## What the Extension Does

The core workflow is **queue-based bulk generation**:

1. The user pastes a prompt list into the side panel and presses **Start**.
2. One or more hidden background **worker tabs** are opened on the Perchance image
   generator page.
3. Each worker receives a prompt, fills in the prompt / negative / image count /
   style / shape fields, clicks **Generate**, and waits.
4. Every generated image is detected in the page's iframes, resolved to a data
   URL / blob / remote source, and saved to disk automatically via the Chrome
   Downloads API with a deterministic filename.
5. The panel shows live per-prompt status, per-worker stats, logs, and an elapsed
   timer until the whole batch finishes.

---

## Feature Overview

### 1. Prompt List Input

- Free-text prompt area in the Dashboard tab.
- **Import** `.txt` and `.csv` files.
- Prompt text is auto-persisted to `chrome.storage.local` and restored on next open.
- Documented formats for attaching per-prompt negative prompts:

| Format | Example | Meaning |
| --- | --- | --- |
| Prefix line | `!blur, low quality` | Negative for the prompt above |
| Inline separator | `a cat \| photography` or `a cat ! photography` | Prompt + its negative on one line |
| Block marker | `<negative>` on its own line | Prompt = everything above, negative = everything below until a blank line |
| CSV | `prompt,negative` | 2-column CSV, imported as a `.csv` file |

### 2. Generation Controls (Dashboard)

- **Art Style** dropdown — full list of Perchance style options (Anime, Cinematic,
  Realistic, Watercolor, Studio Ghibli, etc.), plus "No style" and "Website default".
- **Art Style Mix** dropdown — mirror list for the style-mix setting; "Not Mix" default.
- **Shape** — Portrait `512x768`, Square `512x512`, Landscape `768x512`.
- **Images / Prompt** — number of images per prompt (default 2).
- **Global Negative Prompt** — applied to every prompt unless a prompt has its own.

### 3. Parallel Workers

- **Worker Count** setting (1–6) in the Settings tab.
- The background service worker opens that many hidden tabs on the Perchance
  generator page; each tab becomes a **worker**.
- Workers claim the next pending prompt, generate, download, then take the next.
- Workers are monitored: if a tab fails to register it is reloaded (up to 5
  attempts), and a failed/closed worker is replaced automatically while prompts
  remain.
- **Foreground rotation** — active worker tabs are rotated to the foreground on a
  timer so Perchance keeps rendering without user interaction.

### 4. Pause / Resume / Stop

- **Pause** stops new prompt assignment mid-batch; **Resume** continues from where
  it left off (already-assigned prompts finish first).
- **Stop** aborts the run and closes all worker tabs. Steps already downloaded are
  kept.
- A stopped run can be restarted; a running batch can also be restored after the
  browser restarts (session state is persisted).

### 5. Per-Prompt Management During a Run

While a batch is running the panel lists every prompt with its live status:

- `○ pending` · `◌ processing` · `✓ completed` · `✗ failed` · `⊘ skipped`
- Per-prompt **worker tag** showing which worker is handling it.
- Toggle individual prompts on/off with a checkbox.
- **Disable from here** — skip a prompt plus every pending prompt after it.
- **Enable from here** — re-enable that prompt and all skipped prompts after it.
- Failed prompts are logged and the queue continues; the batch is never aborted by
  a single failure.

### 6. Downloads

Automated via the Chrome Downloads API through the background service worker.

- Images may be `data:` URLs, `blob:` URLs (converted via an injected script in
  the page's iframe), or remote `http(s)` URLs (fetched and converted).
- **Subfolder** — save into a named download subfolder (e.g. `portraits`).
- **Per-prompt folders** — additionally groups images under `001/`, `002/`, ...
- **Filename patterns**:

| Pattern | Example output |
| --- | --- |
| `{prompt_text}_{image_idx}` | `a_cat_001.png` |
| `{prompt_idx}_{image_idx}` | `001_001.png` (default) |
| `{timestamp}_{image_idx}` | `20260920123456_001.png` |
| `{prompt_idx}_{prompt_text}_{image_idx}` | `001_a_cat_001.png` |

- Prompt text is sanitized (lowercased, non-alphanumerics → `_`) and trimmed.

### 7. Prompt Enhancement

- **Prefix** and **Suffix** strings are prepended/appended to every generated
  prompt (e.g. hand-drawn style hints or quality tags).

### 8. Live Progress, Stats & Logs

- **Connection badge** — Online/Offline based on registered worker frames.
- **Logs tab** — timestamped, color-coded log entries (`info / success / error /
  warning`) with worker tags, filterable by type, capped at 1000 entries.
- **Stats panel** — elapsed time, prompts completed/total, images generated, error
  count, per-worker prompts + avg time with comparison bars, plus fastest/slowest
  worker and average time per prompt/image.

### 9. Settings Persistence

All dashboard/settings values (worker count, image count, art style, style mix,
shape, global negative, folder, prefix/suffix, filename pattern, per-prompt
folders) are saved to `chrome.storage.local` and restored on next open.

---

## Accounts, Premium & Quotas

### Sign-in

- The side panel requires **Google sign-in** before use (Chrome `identity` OAuth +
  Firebase Auth). Avatar, name, email, and plan are shown in the Account tab.

### Free vs Premium

| Dimension | Free | Premium |
| --- | --- | --- |
| Daily image quota | 50 images/day | Unlimited |
| Max prompts per batch | 20 | Unlimited |
| Parallel workers | included | included (up to 6) |
| Priority support | — | Yes |

- Usage is tracked locally per UTC day (`usageTracker` in storage) and enforced
  both in the panel (before start) and in the service worker (on `START`), so the
  quota cannot be bypassed from a stale UI.
- The banner and account tab show a live quota bar (warn ≥75%, danger at 100%) and
  modal alerts for low/depleted quota.

### Upgrade & Payment

- Upgrade buttons open a shared checkout page (`auto-perchance.vercel.app/upgrade.html?app=perchance_pro&token=…`)
  with the Firebase ID token as the bearer credential.
- Plans: **Monthly** ~$6.99/mo and **Lifetime** ~$39.99 (USD/INR with live exchange
  rate), processed by **Razorpay**.
- The backend verifies the token, creates the order, and on payment the webhook
  sets **Firebase custom claims** (`premium`, `plan`, `planActivatedAt`) and upserts
  a Firestore `users/{uid}` record + transaction log.
- The extension reads premium status from custom claims first (for instant unlock
  after payment), then falls back to Firestore, with a local cache; "Refresh
  Premium Status" forces a re-check.

---

## Architecture (Extension)

### Content Script (`src/content/`)

- Injected into every `https://*.perchance.org/*` frame at document idle.
- A controller frame (the one holding the generate button) registers with the
  background worker and executes the `CMD_RUN_PROMPT` command — setting field
  values via the native setter (so the page's React state picks the change up),
  dispatching `input`/`change` events, clearing the output area, announcing the
  expected image count, and clicking **Generate**.
- All frames run an image watcher that reports fully-loaded result images
  (`img#resultImgEl`, dimensions > 50×50, not a loading placeholder) once each via
  `IMAGE_READY`.
- The older queue-based path (`queue.ts`, `automation.ts`, `wait.ts`, `dom.ts`,
  `downloader.ts`) is retained; the current build uses the background-orchestrated
  worker pool instead.

### Background Service Worker (`src/background/`)

Holds all run state and orchestrates the worker pool:

- Creates/registers/monitors/replaces worker tabs; rotates them to foreground.
- Assigns pending prompts to idle workers; tracks per-worker stats.
- Receives `IMAGE_READY`, builds the deterministic filename/folder, downloads via
  `chrome.downloads.download`, and increments usage for free users.
- Handles: `START`, `PAUSE`, `RESUME`, `STOP`, `CLEAR`, `CLEAR_LOGS`,
  `SET_PROMPT_SKIPPED`, `DISABLE_PROMPTS_FROM`, `ENABLE_PROMPTS_FROM`,
  `REGISTER_CONTROLLER`, `EXPECT_IMAGES`, `IMAGE_READY`, `GET_STATE`,
  `GET_AUTH_STATE`, and broadcasts `STATE_UPDATED` to the panel after every change.
- Persists `appState` to storage so an interrupted session can be restored
  (validation + "resumed rotation / idle" handling on reload).
- Closes all worker tabs on completion or stop.

### Side Panel (`src/sidebar/`)

Display-only UI, no page DOM access. Four tabs:

- **Dashboard** — prompt list, import, quick settings, Start/Pause/Resume/Stop,
  live prompt list.
- **Settings** — workers, prefix, suffix, subfolder, filename pattern, per-prompt
  folders.
- **Logs** — stats panel + filterable log history.
- **Account** — profile, plan, quota, upgrade / refresh / sign out.

### Auth (`src/auth/`)

- Firebase web-extension auth + Google identity OAuth.
- Premium resolution: custom claims → Firestore fallback → local cache.

### Shared (`src/shared/`)

- `constants.ts` — DOM selectors, storage keys, defaults, free-plan limits,
  FILENAME pattern keys, and the full art-style / style-mix / shape option lists.
- `messages.ts` — typed message contracts between sidebar ↔ content ↔ background.
- `prompt-parser.ts` + tests — text/CSV prompt parsing (incl. negative markers).
- `prompt-status.ts` + tests — pending/skipped/completed state helpers.
- `types.ts` — `Prompt`, `QueueConfig`, `ProgressEvent`.
- `utils.ts` — zero-padding, filename builder, sleep.

---

## Backend (`backend/`)

Firebase Admin + Razorpay, deployed as Vercel serverless functions:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/pricing` | Live USD→INR rate, plan prices; returns Razorpay key id |
| `POST /api/createOrder` | Verifies Firebase token, creates a Razorpay order |
| `POST /api/webhook` | Verifies Razorpay HMAC signature, grants premium via custom claims + Firestore, logs the transaction |
| `GET /api/status` | Reports user premium state; expires monthly plans after 30 days (syncs Firestore + claims) |

---

## Build & Test (`ext/`)

```bash
bun install          # install deps
bun test             # run unit tests (bun test)
bunx tsc --noEmit    # typecheck
bun run build        # format + bundle content/background/sidebar → dist/ + copy assets
```

Build outputs a loadable unpacked extension in `dist/` (also packaged as
`dist.crx` / `dist.zip`).

---

## Storage Keys

| Key | Contents |
| --- | --- |
| `appState` | Full run state (prompts, workers, stats, settings, logs) for session restore |
| `settings` | Panel settings (workers, style, filename pattern, …) |
| `savedPrompts` / `savedPromptsFormat` | Prompt list restored on open |
| `authState` | Signed-in user + premium flag/plan/activation |
| `premiumCache` | Last premium check result |
| `usageTracker` | `{ date, count }` free-tier daily image usage |

---

## Notes

- **Manifest permissions**: `storage`, `downloads`, `sidePanel`, `identity`, with a
  host permission for the Perchance generator page; content script runs on all
  Perchance frames.
- The extension ships with a hard-coded extension `key` and Google OAuth client so
  the packaged ID / auth are stable for sideloading.
- Per-prompt negative prompt wins over the global negative prompt.
- Deterministic filenames and zero-padded indices keep batches organized and
  idempotent.