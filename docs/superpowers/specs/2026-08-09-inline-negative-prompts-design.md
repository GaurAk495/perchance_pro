# Inline Negative Prompts

## Problem

Per-prompt negative prompts are supported, but each syntax puts the negative on
its own line or column: a `!`-prefixed line after the prompt, a `<negative>`
block, or the second CSV column. The user wants the negative **inline** on the
same line as its prompt so prompt lists read naturally without extra lines.

## Goal

Let a prompt carry its negative inline on the same line using a ` | ` separator
(space-pipe-space). Existing `!` and `<negative>` syntaxes keep parsing for
backwards compatibility, but lists re-serialized by the app are written inline.

## Approach

Modify the single shared parser (`src/shared/prompt-parser.ts`) plus its
serialization helper. No changes to types, background, or content scripts.

## Non-Goals

- No settings UI for choosing a separator.
- No auto-detection of multiple separators.
- No removal of existing `!` / `<negative>` / CSV parsing.

---

## 1. Parser grammar

New constant in `prompt-parser.ts`:

```ts
export const INLINE_SEPARATOR = ' | ';
```

### 1.1 Plain-line parsing

In `parseTextPrompts`, when a plain line is added to the group, split it on the
**first** occurrence of ` | `:

- `A castle | blurry` → prompt `A castle`, negative `blurry`.
- `A castle | blurry | low quality` → prompt `A castle`, negative
  `blurry | low quality` (first separator splits; the rest stays in the
  negative).
- `A|B castle` → no separator (no surrounding spaces) → whole line is the
  prompt.
- Empty negative (`A castle | `) → treated as no negative; prompt is `A castle`.

The prompt is pushed as `{ text: main, negative }` immediately (same position
the plain line would otherwise occupy). Implementation detail: when a line
splits, first flush any pending `group` entries as individual prompts, then push
the split prompt — the split line itself is not added to `group`. This preserves
line ordering: `A castle | blurry\nB dragon` → `{A castle, blurry}`, `{B dragon}`.

### 1.2 Interaction with existing syntax

- `!` lines still attach to the *previous* prompt. If that prompt already has
  an inline negative, they merge with `", "`:
  `A castle | blurry\n!low quality` → negative `blurry, low quality`.
- `<negative>` blocks are unchanged: lines above become one multi-line prompt,
  lines below until blank/EOF join with `", "`. No ` | ` splitting inside the
  block.
- A plain line with ` | ` directly above a `<negative>` block: the inline
  negative wins and is merged with the block negative if both exist.
- CSV parsing unchanged.

## 2. Serialization (`promptsToText`)

- Prompt with a negative and **no newline in `text`** → `${text} | ${negative}`.
- Prompt with a **newline in `text`** → keep the `<negative>` block form
  (`\n<negative>\n${negative}`), the only syntax preserving multi-line main
  text.
- Prompt without a negative → `text` as today.
- Prompts joined with `\n\n` as today.

Round-trip remains exact for any prompt whose `text` contains no ` | ` (a known,
documented limitation: a ` | ` inside the prompt text would be re-split).

## 3. UI / docs

- `src/sidebar/sidebar.html` help `<details>`: add a line documenting
  `prompt | negative` inline.
- Prompt list rendering unchanged (`⛔ negative` subtext already exists).

## 4. Testing (`prompt-parser.test.ts`)

New cases:

- `A castle | blurry` → `{ text: 'A castle', negative: 'blurry' }`.
- `A castle | blurry | low quality` → negative `blurry | low quality`.
- `A|B castle` → no negative, text `A|B castle`.
- `A castle | ` → no negative.
- `A castle | blurry\n!low quality` → negative `blurry, low quality`.
- Inline + `<negative>` block merge.
- Round-trip: single-line prompts serialize inline and re-parse identically;
  multi-line prompts still serialize via `<negative>`.

Existing `!` / `<negative>` / CSV tests stay green unchanged (parser keeps that
behavior).

## 5. Verification

- `bun test` passes.
- `bun run build` succeeds.
- `bunx tsc --noEmit` type-checks.

---

## Files touched

| File | Change |
| --- | --- |
| `src/shared/prompt-parser.ts` | `INLINE_SEPARATOR`, plain-line splitting, serialization |
| `src/shared/prompt-parser.test.ts` | new inline cases + round-trip updates |
| `src/sidebar/sidebar.html` | help text line for ` | ` inline |
