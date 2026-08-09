# Per-Prompt Enable / Disable (Skipping)

## Problem

A client runs batches of up to ~500 imported prompts. If a mistake is found
mid-run (e.g. a bad newline repeating every 10 prompts), there is currently no
way to exclude the remaining faulty prompts without stopping the run, editing
the batch, and re-importing. The client wants to disable individual prompts —
ideally "this prompt and everything after it" — while a run is in progress.

## Goal

- A checkbox per prompt row in the sidebar prompt list.
- While running, a pending prompt can be disabled (excluded from execution) or
  re-enabled. Prompts already being generated cannot be toggled mid-flight.
- A per-row "disable from here" action that disables the clicked pending prompt
  and every pending prompt after it in one click.
- Disabled prompts never generate images and render distinctly in the list.
- Disabled selections reset on each new run (textarea stays the source of
  truth).

## Approach

Status-based skipping (Approach 1). Add a `'skipped'` prompt status. Disabling
a pending prompt sets its status to `'skipped'`; re-enabling sets it back to
`'pending'`. The queue picker (`getNextPendingIndex`, `hasPendingPrompts`)
already only considers `'pending'`, so skipped prompts are excluded with **zero
changes to queue logic**.

## Non-Goals

- No interrupting of prompts currently being generated.
- No persistence of disabled selections across runs.
- No batch panel (range / every-Nth toggles); only the per-row checkbox and
  "disable from here".
- The legacy `ProgressEvent` union in `shared/types.ts` is untouched (unused by
  the live flow).

---

## 1. Data model & queue behavior

### 1.1 Status

Add `'skipped'` to the `PromptStatus` union in both `src/background/background.ts`
and `src/sidebar/sidebar.ts`:

```ts
type PromptStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
```

### 1.2 Semantics

- `pending` = enabled, waiting to be assigned.
- `skipped` = disabled by the user.
- Toggling is only allowed between `pending` and `skipped`, and only while
  `state.isRunning` (paused counts as running).
- The queue picker is unchanged: `getNextPendingIndex()` returns the first
  `'pending'` index; skipped prompts are never picked.
- At queue completion, skipped prompts stay `'skipped'` — no extra
  bookkeeping.
- `checkAllComplete` is unchanged: fires when no `'pending'` remains and no
  worker is busy. Disabling everything remaining ends the run normally.

### 1.3 Restore from storage

`promptStatuses` restore already maps missing entries to `'pending'` and
preserves existing entries, so a persisted `'skipped'` survives a restart.
Restored state is forced idle, so toggles are rejected until the next run.

---

## 2. Background messages & handlers

### 2.1 `{ action: 'SET_PROMPT_SKIPPED', index, skipped }`

Single-prompt toggle. Validates `state.isRunning`, `index` range, and that the
current status is `'pending'` or `'skipped'`, then sets:

```ts
state.promptStatuses[index] = skipped ? 'skipped' : 'pending';
```

`saveState()` + `broadcastState()`. No log entry (too noisy when batch
toggling). No worker push needed — idle workers pick the next `'pending'` up
via the existing `assignNextPrompt` chain.

### 2.2 `{ action: 'DISABLE_PROMPTS_FROM', index }`

"Disable from here". Validates `state.isRunning` and `index` range, then:

```ts
for (let i = index; i < state.prompts.length; i++) {
  if (state.promptStatuses[i] === 'pending') state.promptStatuses[i] = 'skipped';
}
```

Only touches pending rows; `processing` / `completed` / `failed` are left
alone. `saveState()` + `broadcastState()`.

### 2.3 Pure helper (`src/shared/prompt-status.ts`)

The state transitions are extracted as immutable, testable helpers:

```ts
export function togglePromptStatus(
  statuses: readonly PromptStatus[],
  index: number,
  skipped: boolean
): PromptStatus[];

export function disableFrom(
  statuses: readonly PromptStatus[],
  from: number
): PromptStatus[];
```

Both return new arrays (no mutation), matching the codebase rule "avoid mutable
global state". The message handlers become thin callers.

---

## 3. Sidebar UI

### 3.1 Row structure (`renderPromptList`)

```html
<li class="${status === 'skipped' ? 'skipped' : ''}">
  <input type="checkbox" class="prompt-enable" ${status === 'skipped' ? '' : 'checked'}
         ${toggleable ? '' : 'disabled'} />
  <span class="status-icon skipped">⊘</span>
  <span class="prompt-num">1.</span>
  <span class="prompt-text">…</span>
  <button class="prompt-skip-btn" data-action="disable-from" data-index="0">⏭ disable from here</button>
  ${workerTag}${negativeSubtext}
</li>
```

- `toggleable` = `state.isRunning && (status === 'pending' || status === 'skipped')`.
- Skipped rows get a muted style and a `⊘` icon (new entry in `iconMap`).
- The "disable from here" button is shown only for pending rows and only while
  running.

### 3.2 Event handling — delegation

The list is rebuilt from an innerHTML string on every state broadcast, so
listeners are attached once to `#prompt-list`:

- `change` event → read `data-index` on the checkbox's `<li>`, send
  `SET_PROMPT_SKIPPED { index, skipped: !checkbox.checked }`.
- `click` on `.prompt-skip-btn` → send `DISABLE_PROMPTS_FROM { index }`.

Both go through `chrome.runtime.sendMessage`; the background broadcasts the new
state back and the list re-renders.

### 3.3 CSS (`src/sidebar/sidebar.css`)

- `.prompt-list li.skipped { opacity: .5; }`
- `.prompt-enable { accent-color: var(--accent); }` (small, aligned with the
  icon column)
- `.prompt-skip-btn` — tiny text button, `visibility: hidden` until the row is
  hovered (`li:hover .prompt-skip-btn { visibility: visible; }`), muted color.

---

## 4. Edge cases & testing

### 4.1 Unit tests (`src/shared/prompt-status.test.ts`)

- `togglePromptStatus`: pending → skipped; skipped → pending; returns a new
  array; leaves other statuses untouched; invalid targets (processing /
  completed / failed) are unchanged.
- `disableFrom`: disables all pending from an index onward; leaves
  processing / completed / failed alone; no-op when nothing pending at/after.

### 4.2 Edge cases

| Case | Behavior |
| --- | --- |
| Toggle while idle / after run | Rejected by background; checkbox disabled |
| Toggle a processing prompt | Checkbox disabled (pending-only rule) |
| Disable everything remaining | `checkAllComplete` fires, workers close, run ends |
| Persisted `'skipped'` in `appState` | Restored; idle so toggles blocked until next run |
| Re-enable a skipped prompt during run | Back to `'pending'`, picked up by next idle worker |
| Pause → toggle → resume | Toggles apply; resume assigns next pending |

### 4.3 Verification

- `bun test` (new status tests + existing parser tests)
- `bunx tsc --noEmit`
- `bun run build`

---

## Files touched

| File | Change |
| --- | --- |
| `src/shared/prompt-status.ts` | **new** — immutable toggle/disable helpers |
| `src/shared/prompt-status.test.ts` | **new** — unit tests |
| `src/background/background.ts` | `'skipped'` in `PromptStatus`; two new message handlers |
| `src/sidebar/sidebar.ts` | `'skipped'` in `PromptStatus`; checkbox + skip button in render; delegation |
| `src/sidebar/sidebar.css` | skipped-row, checkbox, skip-button styles |
