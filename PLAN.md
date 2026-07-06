# Plan: Clean up rotation on worker failure and tab removal

## Goal
Remove tab IDs from the `foregroundQueue` when a worker fails or its tab is removed, preventing stale entries.

## Changes

### 1. `handleWorkerFailure` (line 267-276)
After splicing the worker, add:
```typescript
// Remove from foreground queue if present
const queueIdx = state.foregroundQueue.indexOf(worker.tabId);
if (queueIdx !== -1) state.foregroundQueue.splice(queueIdx, 1);
```

### 2. `chrome.tabs.onRemoved` listener (line 551)
After `state.workers.splice(idx, 1);`, add:
```typescript
// Remove from foreground queue if present
const queueIdx = state.foregroundQueue.indexOf(tabId);
if (queueIdx !== -1) state.foregroundQueue.splice(queueIdx, 1);
```

## Verification
- Run `cd ext && npx tsc --noEmit` to ensure no type errors.

## Commit
- Stage: `ext/src/background/background.ts`
- Message: `feat: clean up foreground queue on worker failure and tab removal`

## Risks
- Minimal: only adds cleanup logic for an existing array.
- No new dependencies or side effects.