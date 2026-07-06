# Foreground Kicker — Queue-Based Tab Rotation

## Problem

Perchance.org requires a tab to be in the foreground for ~2-3 seconds to start image generation. The extension spawns worker tabs as `active: false` (background), so generation never starts unless the user manually switches to each tab. This defeats the purpose of automation.

## Goal

Automatically bring each worker tab to the foreground for ~2-3 seconds when it's assigned a prompt, so generation kicks off without manual intervention. Handle both initial prompt assignment and re-assignment after a worker finishes.

## Scope

- Changes to `background.ts` only (no content script changes needed)
- New state fields, queue management, rotation timer
- Configurable dwell time

## Design

### New State Fields

```typescript
foregroundQueue: number[];   // tabIds waiting for foreground kick
foregroundDwellMs: number;   // ms to keep tab active (default: 3000)
isRotating: boolean;         // whether the rotation timer is running
```

### Core Flow

1. **Enqueue:** When `assignNextPrompt(worker)` is called, after sending `CMD_RUN_PROMPT`, push `worker.tabId` onto `foregroundQueue` and start rotation if not already running.

2. **Rotate:** A repeating timer fires every `foregroundDwellMs`. Each tick:
   - If queue is empty → stop rotation (`isRotating = false`)
   - Pop next `tabId` from queue
   - Call `chrome.tabs.update(tabId, { active: true })` to bring to foreground
   - The content script (already handling `CMD_RUN_PROMPT`) clicks Generate during this dwell
   - Next tick processes the next worker

3. **Re-enqueue on completion:** When a worker finishes (`receivedCount >= expectedCount`) and is assigned a new prompt, it's enqueued again for another foreground kick.

### Timing

- Dwell time: 3 seconds per worker (configurable via `foregroundDwellMs`)
- For 15 workers: ~45 seconds total for initial kick (one-time cost per batch)
- Subsequent re-kicks happen per-worker as they finish

### Edge Cases

- **Tab closed mid-rotation:** `chrome.tabs.update` fails silently; next tick skips it
- **User's active tab:** Rotation briefly switches away from user's tab (unavoidable, 3s per worker)
- **Service worker restart:** Queue is empty on restore; workers that were mid-generation continue in background (they were already kicked)
- **Pause/Resume:** Pause stops rotation; resume restarts it if workers need kicking

### Files Modified

- `ext/src/background/background.ts` — add queue state, rotation timer, enqueue logic in `assignNextPrompt`, rotation timer functions

### No Changes Needed

- `ext/src/content/index.ts` — already handles `CMD_RUN_PROMPT` and clicks Generate
- `ext/src/sidebar/sidebar.ts` — no UI changes needed
- `manifest.json` — no new permissions needed (`tabs` permission already implied by `chrome.tabs` usage)
