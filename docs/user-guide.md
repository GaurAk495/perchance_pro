# User Guide: Negative Prompts & Skipping Prompts

## Negative prompts

There are two levels:

- **Global negative** — applies to every prompt. Type it in the **Negative Prompt**
  box on the Dashboard.
- **Per-prompt negative** — applies to one prompt only. If a prompt has its own
  negative, it **wins**; otherwise the global negative is used.

### Per-prompt syntax

**1. Same line** (easiest). Separator must have spaces around it:

```
A majestic castle | blurry, low quality
A dragon ! extra fingers, deformed hands
```

Both ` | ` and ` ! ` work. The prompt is everything before the separator; the
negative is everything after.

**2. `!` on its own line**, right after the prompt:

```
A majestic castle
!blurry, low quality
```

**3. `<negative>` block** for multi-line prompts — everything above the marker
becomes one prompt, everything below until a blank line is the negative:

```
A castle
on a hill
<negative>
blurry
low quality
```

**4. CSV import** — second column is the negative (import as a `.csv` file):

```
A castle,blurry
A dragon,extra fingers
```

> Tip: a prompt whose *text* contains ` | ` or ` ! ` (with spaces) will be split
> at the first separator. Use the `!`-line or `<negative>` syntax for those.

## Skipping (enable / disable) prompts

While a run is in progress (including while paused):

- **Checkbox** on each row — toggle just that prompt on/off.
- **⏭ disable from here** — appears on enabled rows. Disables that prompt and
  every enabled prompt after it.
- **⏮ enable from here** — appears on disabled rows. Re-enables that prompt and
  every skipped prompt after it.

How it behaves:

- Disabled prompts are skipped during generation. They render dimmed with a
  line-through and a `⊘` icon.
- You can only toggle prompts that haven't run yet. Prompts already
  generating, completed, or failed can't be changed.
- Skip selections reset on every new run — the prompt textarea is always the
  source of truth.
