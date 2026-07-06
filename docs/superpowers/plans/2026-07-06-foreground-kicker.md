# Foreground Kicker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automated foreground tab rotation so worker tabs get ~3 seconds of active time to kick off image generation on perchance.org.

**Architecture:** A queue-based foreground kicker in `background.ts` that cycles through worker tabs, activating each for a configurable dwell time (3s) so the content script can click Generate. The queue is populated whenever a worker is assigned a prompt.

**Tech Stack:** TypeScript, Chrome Extension APIs (`chrome.tabs.update`)

---

### Task 1: Add foreground kicker state fields and initialization

**Files:**
- Modify: `ext/src/background/background.ts:31-73` (AppState interface + createInitialState)

- [ ] **Step 1: Add new fields to AppState interface**

At `ext/src/background/background.ts:31`, add three new fields to the `AppState` interface after `nextWorkerIndex`:

```typescript
interface AppState {
  // ... existing fields ...
  nextWorkerIndex: number;
  foregroundQueue: number[];
  foregroundDwellMs: number;
  isRotating: boolean;
}
```

- [ ] **Step 2: Initialize new fields in createInitialState**

At `ext/src/background/background.ts:52`, add the three new fields to the return object of `createInitialState()`:

```typescript
function createInitialState(): AppState {
  return {
    // ... existing fields ...
    nextWorkerIndex: 0,
    foregroundQueue: [],
    foregroundDwellMs: 3000,
    isRotating: false,
  };
}
```

- [ ] **Step 3: Verify build compiles**

Run: `cd ext && npx tsc --noEmit`
Expected: No errors (new fields are optional-compatible with spread restore)

- [ ] **Step 4: Commit**

```bash
git add ext/src/background/background.ts
git commit -m "feat: add foreground kicker state fields"
```

---

### Task 2: Implement rotation functions

**Files:**
- Modify: `ext/src/background/background.ts` (add after `closeWorkers` function, around line 354)

- [ ] **Step 1: Add enqueueForegroundKick function**

Insert after the `closeWorkers` function (after line 354):

```typescript
function enqueueForegroundKick(tabId: number): void {
  if (!state.foregroundQueue.includes(tabId)) {
    state.foregroundQueue.push(tabId);
  }
  if (!state.isRotating) {
    startRotation();
  }
}
```

- [ ] **Step 2: Add startRotation function**

Insert after `enqueueForegroundKick`:

```typescript
let rotationTimer: ReturnType<typeof setInterval> | null = null;

function startRotation(): void {
  if (state.isRotating) return;
  state.isRotating = true;
  rotationTimer = setInterval(rotateForeground, state.foregroundDwellMs);
  rotateForeground();
}
```

- [ ] **Step 3: Add rotateForeground function**

Insert after `startRotation`:

```typescript
function rotateForeground(): void {
  if (state.foregroundQueue.length === 0) {
    stopRotation();
    return;
  }

  const tabId = state.foregroundQueue.shift()!;
  chrome.tabs.update(tabId, { active: true }, () => {
    if (chrome.runtime.lastError) {
      // Tab may have been closed; skip silently
    }
  });
}
```

- [ ] **Step 4: Add stopRotation function**

Insert after `rotateForeground`:

```typescript
function stopRotation(): void {
  state.isRotating = false;
  if (rotationTimer !== null) {
    clearInterval(rotationTimer);
    rotationTimer = null;
  }
  state.foregroundQueue = [];
}
```

- [ ] **Step 5: Verify build compiles**

Run: `cd ext && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add ext/src/background/background.ts
git commit -m "feat: add foreground rotation timer functions"
```

---

### Task 3: Enqueue workers in assignNextPrompt

**Files:**
- Modify: `ext/src/background/background.ts:200-257` (assignNextPrompt function)

- [ ] **Step 1: Add enqueue call after sending CMD_RUN_PROMPT**

In `assignNextPrompt`, after the `chrome.tabs.sendMessage` call succeeds (inside the callback, before the error check), enqueue the worker for foreground kick. Modify the callback at line 244 to:

```typescript
    chrome.tabs.sendMessage(
      worker.tabId,
      {
        action: 'CMD_RUN_PROMPT',
        prompt: finalPrompt,
        negativePrompt: state.negativePrompt,
        numImages: state.numImages,
      },
      { frameId: worker.frameId! },
      () => {
        if (chrome.runtime.lastError) {
          log(`Worker unreachable. Prompt ${idx + 1} failed.`, 'error', worker.workerIndex);
          state.promptStatuses[idx] = 'failed';
          const stat = getOrCreateWorkerStat(worker.workerIndex);
          stat.errors++;
          worker.busy = false;
          worker.currentPromptIndex = null;
          broadcastState();
          handleWorkerFailure(worker);
        } else {
          enqueueForegroundKick(worker.tabId);
        }
      }
    );
```

- [ ] **Step 2: Verify build compiles**

Run: `cd ext && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add ext/src/background/background.ts
git commit -m "feat: enqueue workers for foreground kick on prompt assignment"
```

---

### Task 4: Handle rotation in STOP, PAUSE, RESUME

**Files:**
- Modify: `ext/src/background/background.ts:423-444` (STOP, PAUSE, RESUME handlers)

- [ ] **Step 1: Stop rotation on STOP**

In the STOP handler (line 423), add `stopRotation()` after setting `isRunning = false`:

```typescript
  } else if (msg.action === 'STOP') {
    state.isRunning = false;
    state.isPaused = false;
    stopRotation();
    log('Stopped by user.', 'warning');
    closeWorkers();
    saveState();
    sendResponse({ status: 'stopped' });
```

- [ ] **Step 2: Stop rotation on PAUSE**

In the PAUSE handler (line 430), add `stopRotation()` after setting `isPaused = true`:

```typescript
  } else if (msg.action === 'PAUSE') {
    state.isPaused = true;
    stopRotation();
    log('Paused.', 'info');
    saveState();
    sendResponse({ status: 'paused' });
```

- [ ] **Step 3: Restart rotation on RESUME if workers need kicking**

In the RESUME handler (line 435), after resuming, check if any busy workers need foreground kick:

```typescript
  } else if (msg.action === 'RESUME') {
    state.isPaused = false;
    log('Resumed.', 'info');
    saveState();

    // Re-enqueue any busy workers that might need a foreground kick
    for (const w of state.workers) {
      if (w.busy) {
        enqueueForegroundKick(w.tabId);
      }
    }

    if (hasPendingPrompts()) {
      const idleWorker = findIdleWorker();
      if (idleWorker) assignNextPrompt(idleWorker);
    }
    sendResponse({ status: 'resumed' });
```

- [ ] **Step 4: Verify build compiles**

Run: `cd ext && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add ext/src/background/background.ts
git commit -m "feat: handle rotation lifecycle in stop/pause/resume"
```

---

### Task 5: Clean up rotation on worker failure and tab removal

**Files:**
- Modify: `ext/src/background/background.ts:259-268` (handleWorkerFailure)
- Modify: `ext/src/background/background.ts:475-497` (tabs.onRemoved listener)

- [ ] **Step 1: Remove failed worker from foreground queue**

In `handleWorkerFailure`, add cleanup before the replacement logic:

```typescript
function handleWorkerFailure(worker: WorkerTab): void {
  const idx = state.workers.indexOf(worker);
  if (idx !== -1) state.workers.splice(idx, 1);

  // Remove from foreground queue if present
  const queueIdx = state.foregroundQueue.indexOf(worker.tabId);
  if (queueIdx !== -1) state.foregroundQueue.splice(queueIdx, 1);

  if (state.isRunning && hasPendingPrompts()) {
    log('Creating replacement worker...', 'warning');
    createWorkerTab();
  }
  checkAllComplete();
}
```

- [ ] **Step 2: Remove closed tab from foreground queue**

In the `chrome.tabs.onRemoved` listener (line 475), add queue cleanup after splicing the worker:

```typescript
chrome.tabs.onRemoved.addListener((tabId) => {
  const idx = state.workers.findIndex((w) => w.tabId === tabId);
  if (idx === -1) return;

  const worker: WorkerTab | undefined = state.workers[idx];
  if (!worker) return;
  const promptIdx = worker.currentPromptIndex;
  if (promptIdx !== null && state.promptStatuses[promptIdx] === 'processing') {
    state.promptStatuses[promptIdx] = 'pending';
    state.promptWorkers[promptIdx] = null;
    const stat = getOrCreateWorkerStat(worker.workerIndex);
    stat.errors++;
    log(`Worker closed mid-prompt. Reassigning ${promptIdx + 1}.`, 'warning', worker.workerIndex);
  }

  state.workers.splice(idx, 1);

  // Remove from foreground queue if present
  const queueIdx = state.foregroundQueue.indexOf(tabId);
  if (queueIdx !== -1) state.foregroundQueue.splice(queueIdx, 1);

  if (state.isRunning && hasPendingPrompts()) {
    createWorkerTab();
  }
  checkAllComplete();
  broadcastState();
});
```

- [ ] **Step 3: Verify build compiles**

Run: `cd ext && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add ext/src/background/background.ts
git commit -m "feat: clean up foreground queue on worker failure and tab removal"
```

---

### Task 6: Build and manual verification

**Files:**
- None (verification only)

- [ ] **Step 1: Build the extension**

Run: `cd ext && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Load in Chrome and test**

1. Load the built extension from `ext/dist/` in `chrome://extensions`
2. Open the sidebar, enter 3+ prompts
3. Set worker count to 3
4. Click Start
5. Verify: tabs are automatically brought to foreground in sequence (~3s each)
6. Verify: generation starts on each tab without manual switching
7. Verify: when a worker finishes and gets a new prompt, it's re-enqueued for foreground kick

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add ext/src/background/background.ts
git commit -m "feat: foreground kicker - automated tab rotation"
```
