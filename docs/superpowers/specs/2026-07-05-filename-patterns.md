# Filename Patterns & Per-Prompt Folders

## Overview

Two settings to control how generated images are organized on disk.

## Filename Pattern

A dropdown in Settings selecting how each image file is named.

### Variables

| Variable | Meaning | Example |
|---|---|---|
| `{prompt_text}` | Sanitized prompt text, truncated to 20 chars | `a_cat_in_a_hat` |
| `{prompt_idx}` | Prompt index (1-based), zero-padded 3 digits | `003` |
| `{image_idx}` | Image index (1-based), zero-padded 3 digits | `001` |
| `{timestamp}` | Current timestamp `YYYYMMDD_HHmmss` | `20260705_143022` |

### Pattern Options

1. **`{prompt_text}_{image_idx}`** (default) — `a_cat_in_a_hat_001.png`
2. **`{prompt_idx}_{image_idx}`** — `003_001.png`
3. **`{timestamp}_{image_idx}`** — `20260705_143022_001.png`
4. **`{prompt_idx}_{prompt_text}_{image_idx}`** — `003_a_cat_in_a_hat_001.png`

Pattern stored as `filenamePattern` in settings (string key like `"prompt_text_image_idx"`).

### Prompt Text Sanitization

- Replace non-alphanumeric chars with `_`
- Collapse multiple `_` to one
- Strip leading/trailing `_`
- Truncate to 20 chars

## Per-Prompt Folders

A checkbox in Settings (`perPromptFolders`). When enabled, images for prompt N are placed in subfolder `{prompt_idx}/`.

### Path Resolution

```
folderName=""   perPromptFolders=false → {filename}.png
folderName=""   perPromptFolders=true  → {prompt_idx}/{filename}.png
folderName="x"  perPromptFolders=false → x/{filename}.png
folderName="x"  perPromptFolders=true  → x/{prompt_idx}/{filename}.png
```

Where `{filename}` is the result of the selected filename pattern.

## Affected Files

| File | Change |
|---|---|
| `shared/constants.ts` | Add `filenamePattern` and `perPromptFolders` defaults |
| `background/background.ts` | Use new settings in `onWorkerImageReady` for path construction |
| `sidebar/sidebar.html` | Add dropdown + checkbox to Settings tab |
| `sidebar/sidebar.css` | Styles for new form elements |
| `sidebar/sidebar.ts` | Bind UI to settings, pass to background on START |

## Migration

Existing saved state without `filenamePattern`/`perPromptFolders` defaults to `"prompt_text_image_idx"` and `false`.
