# Per-Prompt Negative Prompts

## Problem

The extension lets the user import a large list of prompts and run bulk image
generation on Perchance. Today there is a single **global** negative prompt that
applies to every prompt. For some projects the client wants to attach a
*different* negative prompt to individual prompts in the imported list, so
generation results are more accurate per prompt.

## Goal

Let a prompt list carry an optional per-prompt negative prompt, defined inline
in the imported text using one of three syntaxes:

1. A `!`-prefixed line right after a prompt.
2. A `<negative>` separator block that also enables multi-line main prompts.
3. A second column in an imported `.csv` file.

When a prompt has its own negative, it **wins**; otherwise the global negative
prompt is used as fallback.

## Approach

Shared, unit-tested parser module + structured prompts end to end (Approach A).

- One parser in `src/shared/prompt-parser.ts` consumed by both the sidebar
  (parse at START, render subtext) and unit tests.
- `Prompt` gains an optional `negative` field; the `START` message and
  background state carry `Prompt[]`.
- Per-prompt negative resolution happens in `background.assignNextPrompt`
  (`prompt.negative ?? state.negativePrompt`). Content scripts are unchanged.

## Non-Goals

- No global setting change: the existing global negative field keeps working.
- No auto-detection of CSV in pasted text (format is chosen explicitly at
  import time).
- No comments (`#`), no per-prompt prefix/suffix, no negative prefix/suffix.

---

## 1. Parser grammar

New module `src/shared/prompt-parser.ts`:

```ts
parsePromptList(text: string, format: 'text' | 'csv'): Prompt[]
```

### 1.1 Text grammar (line + block mode, unified)

One rule preserves today's behavior exactly: **a plain line is always its own
prompt, unless a `<negative>` line follows it.**

**`!` prefix line** — attaches to the *previous* line as its negative.

```
A majestic castle on a hill
!blurry, low quality
A dragon
```

- Result: `"A majestic castle on a hill"` (neg: `"blurry, low quality"`),
  `"A dragon"` (no negative).
- Multiple consecutive `!` lines merge with `", "`.
- A leading `!` with nothing before it is dropped.

**`<negative>` separator block** — everything before it becomes *one* prompt
(multi-line allowed); everything after it until a blank line / EOF is the
negative.

```
A castle
on a hill
<negative>
blurry
low quality

A dragon
<negative>
deformed hands
```

- Result: `"A castle\non a hill"` (neg: `"blurry, low quality"`), `"A dragon"`
  (neg: `"deformed hands"`).
- A blank line is required after the negative block (the record ends there).
  Without a blank line, following lines are swallowed into the negative.
- Negative block lines join with `", "`.
- `<negative>` is case-sensitive and must be on its own line.
- A `<negative>` with no pending prompt (e.g. preceded by a blank line)
  attaches to the last emitted prompt.

**Mixed lists work**: `!` lines, `<negative>` blocks, and plain lines coexist
in one file.

### 1.2 CSV grammar

`.csv` content is parsed with a proper CSV reader: quoted fields may contain
commas, `""` is an escaped quote inside a field, fields split on commas, records
split on newlines. Column 1 = prompt, column 2 = negative. Rows with only a
prompt column get no negative. Blank rows are skipped. The first row is treated
as data (header rows must be removed by the user).

### 1.3 Format selection (deterministic)

- `.csv` file import → `format: 'csv'`
- `.txt` import, manual paste, or any textarea edit → `format: 'text'`
- Stored as `savedPromptsFormat` in `chrome.storage.local` next to
  `savedPrompts`.
- CSV pasted into the textarea manually is *not* parsed as CSV; users should
  use `!` syntax instead. This limitation is documented in the sidebar help.

### 1.4 Round-trip helper

`promptsToText(prompts: Prompt[]): string` serializes a parsed list back to
`!`-syntax text so the textarea-sync edge case preserves negatives:

```
prompt.text + (prompt.negative ? '\n!' + prompt.negative : '')
```

joined with `\n`. Re-parsing the output must yield the identical list.

---

## 2. Data model & message flow

### 2.1 Prompt type

`src/shared/types.ts`:

```ts
export interface Prompt {
  text: string;
  negative?: string;
}
```

This is the only change to that file. (`messages.ts` queue types are legacy and
unused by the live flow; they are left alone.)

### 2.2 Sidebar (`src/sidebar/sidebar.ts`)

- `handleStart()`: replace the `.split('\n')` parsing with
  `parsePromptList(textarea.value, currentFormat)` and send
  `prompts: Prompt[]` in the `START` message.
- `initImportExport()`:
  - On file import: if the file name ends with `.csv`, set
    `savedPromptsFormat: 'csv'`; otherwise `'text'`.
  - Textarea `input` handler: always set `savedPromptsFormat: 'text'` (manual
    edits invalidate CSV semantics).
  - Load `savedPromptsFormat` alongside `savedPrompts`.
- UI rendering is described in Section 3.

### 2.3 Background (`src/background/background.ts`)

- `state.prompts` becomes `Prompt[]` (all assignments typed as `Prompt[]`).
- `START` handler: `state.prompts = msg.prompts as Prompt[]`.
- `assignNextPrompt` — the only logic change:

  ```ts
  const prompt = state.prompts[idx];
  const finalPrompt = `${state.prefix}${prompt.text}${state.suffix}`;
  const negative = prompt.negative ?? state.negativePrompt; // per-prompt wins, else global
  ```

  and sends `negativePrompt: negative` in `CMD_RUN_PROMPT`.
- `onWorkerImageReady`: filename uses `state.prompts[promptIdx]?.text`.
- `sanitizePrompt` / `buildImageFilename` unchanged (they already take the
  main text).
- Storage-restore logic unchanged: `promptStatuses` / `promptWorkers` map over
  `state.prompts` regardless of its shape.

### 2.4 Content script — unchanged

`src/content/automation.ts` already receives `negativePrompt` and fills the
Perchance negative box. It does not care where the negative came from.

### 2.5 Prefix / suffix / filenames

- Prefix/suffix apply only to the main prompt text.
- Multi-line prompts sanitize to underscores in filenames (existing
  `sanitizePrompt` already handles non-alphanumeric characters).

---

## 3. Sidebar UI

### 3.1 Prompt list subtext

`renderPromptList` renders a dim subtext line under each prompt that has a
negative:

```html
<li>
  <span class="status-icon pending">○</span>
  <span class="prompt-num">1.</span>
  <span class="prompt-text">A castle on a hill</span>
  <div class="prompt-negative">⛔ blurry, low quality</div>
</li>
```

- New CSS class `.prompt-negative`: small, dim, wraps, indented under the
  prompt text (style mirrors the existing list aesthetic in `sidebar.css`).
- The status `w{idx}` worker tag and status icons are unchanged.

### 3.2 Textarea sync edge case

`renderAll` repopulates the textarea from `state.prompts.join('\n')` when the
textarea is empty mid-run. Update it to use `promptsToText(state.prompts)` so
negatives are preserved and re-parsing yields the identical list.

### 3.3 Help text

A collapsed `<details>` element under the prompt textarea in
`src/sidebar/sidebar.html`, titled "Per-prompt negative prompts", with tiny
examples of the three syntaxes:

- `!` line right after a prompt
- `<negative>` block
- CSV second column (import as `.csv`)

This is the only user-facing documentation for the feature.

---

## 4. Testing

### 4.1 Test runner

- New `src/shared/prompt-parser.test.ts` using `bun test`.
- Add `"test": "bun test"` to `package.json`.

### 4.2 Coverage

- Plain list → one prompt per line, no negatives (regression guard for current
  behavior).
- `!` line attaches to previous prompt; multiple `!` merge.
- Leading `!` dropped.
- `<negative>` block → multi-line main + joined negative.
- `<negative>` without a following blank line → swallowed until next
  marker/EOF.
- Blank line before `<negative>` → attaches to last emitted prompt.
- Mixed `!` + `<negative>` + plain lines in one list.
- CSV: quoted fields with commas, `""` escapes, missing second column, blank
  rows.
- Round-trip: `promptsToText(parsed)` re-parses to the same list.

### 4.3 Verification

- `bun test` passes.
- `bun run build` succeeds (prettier + bundling).
- Type-check via `bunx tsc --noEmit` (add a `"typecheck"` script if none
  exists).

---

## Files touched

| File | Change |
| --- | --- |
| `src/shared/types.ts` | `Prompt` gains `negative?: string` |
| `src/shared/prompt-parser.ts` | **new** — parser + round-trip helper |
| `src/shared/prompt-parser.test.ts` | **new** — unit tests |
| `src/sidebar/sidebar.ts` | parse at START, format flag, subtext render |
| `src/sidebar/sidebar.html` | help `<details>` |
| `src/sidebar/sidebar.css` | `.prompt-negative` style |
| `src/background/background.ts` | `Prompt[]` state, negative resolution |
| `package.json` | `test` script (+ `typecheck` if absent) |
