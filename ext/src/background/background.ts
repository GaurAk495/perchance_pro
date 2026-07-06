import { DEFAULTS, FILENAME_PATTERNS, type FilenamePatternKey } from '../shared/constants.ts';

interface WorkerTab {
  tabId: number;
  workerIndex: number;
  frameId: number | null;
  busy: boolean;
  currentPromptIndex: number | null;
  expectedCount: number;
  receivedCount: number;
  promptStartedAt: number;
  tabCreatedAt: number;
}

type PromptStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface LogEntry {
  text: string;
  type: 'info' | 'success' | 'error' | 'warning';
  workerIndex?: number;
}

interface WorkerStat {
  workerIndex: number;
  promptsCompleted: number;
  imagesGenerated: number;
  totalTimeMs: number;
  errors: number;
}

interface AppState {
  prompts: string[];
  currentIndex: number;
  isRunning: boolean;
  isPaused: boolean;
  negativePrompt: string;
  numImages: number;
  workerCount: number;
  workers: WorkerTab[];
  promptStatuses: PromptStatus[];
  promptWorkers: (number | null)[];
  folderName: string;
  prefix: string;
  suffix: string;
  filenamePattern: FilenamePatternKey;
  perPromptFolders: boolean;
  logs: LogEntry[];
  workerStats: WorkerStat[];
  nextWorkerIndex: number;
  foregroundQueue: number[];
  foregroundDwellMs: number;
  isRotating: boolean;
}

function createInitialState(): AppState {
  return {
    prompts: [],
    currentIndex: 0,
    isRunning: false,
    isPaused: false,
    negativePrompt: '',
    numImages: 1,
    workerCount: DEFAULTS.workerCount,
    workers: [],
    promptStatuses: [],
    promptWorkers: [],
    folderName: '',
    prefix: '',
    suffix: '',
    filenamePattern: DEFAULTS.filenamePattern,
    perPromptFolders: DEFAULTS.perPromptFolders,
    logs: [],
    workerStats: [],
    nextWorkerIndex: 0,
    foregroundQueue: [],
    foregroundDwellMs: DEFAULTS.foregroundDwellMs,
    isRotating: false,
  };
}

let state: AppState = createInitialState();

// ─── Init ───

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.storage.local.get(['appState'], (res) => {
  if (res.appState) {
    const saved = res.appState as Partial<AppState>;
    state = { ...createInitialState(), ...saved };
    state.workers = [];
    state.promptStatuses = state.prompts.map((_, idx) => state.promptStatuses[idx] ?? 'pending');
    state.promptWorkers = state.prompts.map((_, idx) => state.promptWorkers[idx] ?? null);

    if (!state.filenamePattern) state.filenamePattern = DEFAULTS.filenamePattern;
    if (state.perPromptFolders === undefined) state.perPromptFolders = DEFAULTS.perPromptFolders;

    if (Array.isArray(state.logs) && state.logs.length > 0 && typeof state.logs[0] === 'string') {
      state.logs = (state.logs as unknown as string[]).map((text) => ({
        text,
        type: 'info' as const,
      }));
    }

    if (state.isRunning) {
      state.isRunning = false;
      state.isPaused = false;
      log('Restored from previous session. Idle.', 'info');
    }
    broadcastState();
  } else {
    log('Extension initialized.', 'info');
  }
});

// ─── State management ───

function saveState(): void {
  chrome.storage.local.set({ appState: state }).catch(() => {});
  broadcastState();
}

function broadcastState(): void {
  chrome.runtime.sendMessage({ action: 'STATE_UPDATED', state }).catch(() => {});
}

function log(msg: string, type: LogEntry['type'] = 'info', workerIndex?: number): void {
  const ts = new Date().toLocaleTimeString();
  const entry: LogEntry = { text: `[${ts}] ${msg}`, type };
  if (workerIndex !== undefined) entry.workerIndex = workerIndex;
  state.logs.push(entry);
  if (state.logs.length > 1000) state.logs.splice(0, state.logs.length - 1000);
  saveState();
}

function getWorkerLogIndex(worker: WorkerTab): number | undefined {
  return worker.workerIndex;
}

function getOrCreateWorkerStat(workerIndex: number): WorkerStat {
  let stat = state.workerStats.find((s) => s.workerIndex === workerIndex);
  if (!stat) {
    stat = { workerIndex, promptsCompleted: 0, imagesGenerated: 0, totalTimeMs: 0, errors: 0 };
    state.workerStats.push(stat);
  }
  return stat;
}

// ─── Worker pool ───

function createWorkerTab(): void {
  chrome.tabs.create(
    { url: 'https://perchance.org/image-generator-professional', active: false },
    (tab) => {
      const tabId: number | undefined = tab.id;
      if (tabId === undefined) {
        log('Failed to create worker tab.', 'error');
        return;
      }
      const workerIndex = state.nextWorkerIndex++;
      state.workers.push({
        tabId,
        workerIndex,
        frameId: null,
        busy: false,
        currentPromptIndex: null,
        expectedCount: 0,
        receivedCount: 0,
        promptStartedAt: 0,
        tabCreatedAt: Date.now(),
      });
      getOrCreateWorkerStat(workerIndex);
      log(`Worker tab created (id=${tabId}).`, 'info', workerIndex);
      broadcastState();

      setTimeout(() => checkWorkerRegistration(tabId), DEFAULTS.workerCreateTimeout);
    }
  );
}
function checkWorkerRegistration(tabId: number): void {
  const worker = state.workers.find((w) => w.tabId === tabId);
  if (!worker) return;
  if (worker.frameId === null) {
    log(`Worker tab not responding. Reloading...`, 'warning', worker.workerIndex);
    chrome.tabs.reload(tabId, () => {
      worker.tabCreatedAt = Date.now();
      setTimeout(() => checkWorkerRegistration(tabId), DEFAULTS.workerCreateTimeout);
    });
  }
}

function findIdleWorker(): WorkerTab | undefined {
  return state.workers.find((w) => !w.busy && w.frameId !== null);
}

function hasPendingPrompts(): boolean {
  return state.promptStatuses.some((s) => s === 'pending');
}

function getNextPendingIndex(): number {
  return state.promptStatuses.indexOf('pending');
}

function assignNextPrompt(worker: WorkerTab): void {
  if (!state.isRunning || state.isPaused) return;

  const idx = getNextPendingIndex();
  if (idx === -1) {
    checkAllComplete();
    return;
  }

  const rawPrompt = state.prompts[idx];
  if (!rawPrompt) {
    state.promptStatuses[idx] = 'failed';
    broadcastState();
    assignNextPrompt(worker);
    return;
  }

  worker.busy = true;
  worker.currentPromptIndex = idx;
  worker.expectedCount = 0;
  worker.receivedCount = 0;
  worker.promptStartedAt = Date.now();

  state.promptStatuses[idx] = 'processing';
  state.promptWorkers[idx] = worker.workerIndex;
  broadcastState();

  const finalPrompt = `${state.prefix}${rawPrompt}${state.suffix}`;

  log(
    `[${idx + 1}/${state.prompts.length}] "${rawPrompt.substring(0, 40)}..."`,
    'info',
    worker.workerIndex
  );

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
}

function handleWorkerFailure(worker: WorkerTab): void {
  const idx = state.workers.indexOf(worker);
  if (idx !== -1) state.workers.splice(idx, 1);

  if (state.isRunning && hasPendingPrompts()) {
    log('Creating replacement worker...', 'warning');
    createWorkerTab();
  }
  checkAllComplete();
}

function sanitizePrompt(text: string): string {
  return text
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 20);
}

function buildImageFilename(promptText: string, promptIdx: number, imageIdx: number): string {
  const fmt =
    FILENAME_PATTERNS[state.filenamePattern] ?? FILENAME_PATTERNS['prompt_text_image_idx'];
  const vars: Record<string, string> = {
    prompt_text: sanitizePrompt(promptText),
    prompt_idx: String(promptIdx + 1).padStart(3, '0'),
    image_idx: String(imageIdx).padStart(3, '0'),
    timestamp: new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14),
  };
  return fmt.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? key);
}

function onWorkerImageReady(worker: WorkerTab, src: string): void {
  const promptIdx = worker.currentPromptIndex;
  if (promptIdx === null) return;

  const promptText = state.prompts[promptIdx] ?? 'unknown';
  const baseName = buildImageFilename(promptText, promptIdx, worker.receivedCount + 1);
  const folderParts: string[] = [];
  if (state.folderName) folderParts.push(state.folderName);
  if (state.perPromptFolders) folderParts.push(String(promptIdx + 1).padStart(3, '0'));
  const folder = folderParts.length > 0 ? `${folderParts.join('/')}/` : '';
  const filename = `${folder}${baseName}.png`;

  chrome.downloads.download({ url: src, filename, saveAs: DEFAULTS.saveAs }, () => {
    if (chrome.runtime.lastError) {
      log(`Download failed: ${chrome.runtime.lastError.message}`, 'error', worker.workerIndex);
    }
    worker.receivedCount++;
    log(`[${promptIdx + 1}] ${filename}`, 'success', worker.workerIndex);
    broadcastState();

    if (worker.expectedCount > 0 && worker.receivedCount >= worker.expectedCount) {
      const elapsed = Date.now() - worker.promptStartedAt;
      const stat = getOrCreateWorkerStat(worker.workerIndex);
      stat.promptsCompleted++;
      stat.imagesGenerated += worker.receivedCount;
      stat.totalTimeMs += elapsed;

      state.promptStatuses[promptIdx] = 'completed';
      log(
        `Prompt ${promptIdx + 1} done (${worker.receivedCount} images, ${(elapsed / 1000).toFixed(1)}s)`,
        'success',
        worker.workerIndex
      );
      worker.busy = false;
      worker.currentPromptIndex = null;
      broadcastState();

      if (state.isRunning && !state.isPaused) {
        const nextIdle = findIdleWorker();
        if (nextIdle) assignNextPrompt(nextIdle);
      }
      checkAllComplete();
    }
  });
}

function checkAllComplete(): void {
  if (!hasPendingPrompts() && state.workers.every((w) => !w.busy)) {
    state.isRunning = false;
    state.isPaused = false;
    log('=== All prompts completed! ===', 'success');
    closeWorkers();
    saveState();
  }
}

function closeWorkers(): void {
  for (const w of state.workers) {
    chrome.tabs.remove(w.tabId).catch(() => {});
  }
  state.workers = [];
}

function enqueueForegroundKick(tabId: number): void {
  if (!state.foregroundQueue.includes(tabId)) {
    state.foregroundQueue.push(tabId);
  }
  if (!state.isRotating) {
    startRotation();
  }
}

let rotationTimer: ReturnType<typeof setInterval> | null = null;

function startRotation(): void {
  if (state.isRotating) return;
  state.isRotating = true;
  rotationTimer = setInterval(rotateForeground, state.foregroundDwellMs);
  rotateForeground();
}

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

function stopRotation(): void {
  state.isRotating = false;
  if (rotationTimer !== null) {
    clearInterval(rotationTimer);
    rotationTimer = null;
  }
  state.foregroundQueue = [];
}

function spawnWorkers(count: number): void {
  const effectiveCount = Math.min(count, state.prompts.length);
  for (let i = 0; i < effectiveCount; i++) {
    createWorkerTab();
  }
}
// ─── Message handler ───

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'REGISTER_CONTROLLER') {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return false;

    let worker = state.workers.find((w) => w.tabId === tabId);
    if (!worker) {
      const workerIndex = state.nextWorkerIndex++;
      worker = {
        tabId,
        workerIndex,
        frameId: null,
        busy: false,
        currentPromptIndex: null,
        expectedCount: 0,
        receivedCount: 0,
        promptStartedAt: 0,
        tabCreatedAt: Date.now(),
      };
      state.workers.push(worker);
      getOrCreateWorkerStat(workerIndex);
    }

    worker.frameId = sender.frameId ?? null;
    log(`Worker registered.`, 'info', worker.workerIndex);

    if (state.isRunning && !state.isPaused) {
      assignNextPrompt(worker);
    }
    broadcastState();
    sendResponse({ status: 'registered' });
  } else if (msg.action === 'START') {
    const prompts = msg.prompts as string[];
    if (!prompts.length) return false;

    state.prompts = prompts;
    state.negativePrompt = (msg.negativePrompt as string) || '';
    state.numImages = (msg.numImages as number) || 1;
    state.workerCount = (msg.workerCount as number) || DEFAULTS.workerCount;
    state.folderName = (msg.folderName as string) || '';
    state.prefix = (msg.prefix as string) || '';
    state.suffix = (msg.suffix as string) || '';
    state.filenamePattern = (msg.filenamePattern as FilenamePatternKey) || DEFAULTS.filenamePattern;
    state.perPromptFolders = (msg.perPromptFolders as boolean) ?? DEFAULTS.perPromptFolders;
    state.currentIndex = 0;
    state.isRunning = true;
    state.isPaused = false;
    state.promptStatuses = prompts.map(() => 'pending' as PromptStatus);
    state.promptWorkers = prompts.map(() => null);
    state.workerStats = [];
    state.nextWorkerIndex = 0;
    state.foregroundQueue = [];
    state.isRotating = false;

    log(
      `Started (${prompts.length} prompts, ${state.numImages} img/ea, ${state.workerCount} workers)`,
      'info'
    );
    saveState();

    spawnWorkers(state.workerCount);
    sendResponse({ status: 'started' });
  } else if (msg.action === 'STOP') {
    state.isRunning = false;
    state.isPaused = false;
    stopRotation();
    log('Stopped by user.', 'warning');
    closeWorkers();
    saveState();
    sendResponse({ status: 'stopped' });
  } else if (msg.action === 'PAUSE') {
    state.isPaused = true;
    stopRotation();
    log('Paused.', 'info');
    saveState();
    sendResponse({ status: 'paused' });
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
  } else if (msg.action === 'EXPECT_IMAGES') {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return false;
    const worker = state.workers.find((w) => w.tabId === tabId);
    if (!worker) return false;

    worker.expectedCount = msg.count as number;
    worker.receivedCount = 0;
    broadcastState();
  } else if (msg.action === 'IMAGE_READY') {
    const tabId = sender.tab?.id;
    if (tabId === undefined || !state.isRunning) return false;
    const worker = state.workers.find((w) => w.tabId === tabId);
    if (!worker || worker.currentPromptIndex === null) return false;

    onWorkerImageReady(worker, msg.src as string);
  } else if (msg.action === 'GET_STATE') {
    sendResponse(state);
  } else if (msg.action === 'CLEAR_LOGS') {
    state.logs = [];
    log('Logs cleared.', 'info');
    saveState();
    sendResponse({ status: 'cleared' });
  }

  return true;
});

// ─── Tab cleanup ───

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

  if (state.isRunning && hasPendingPrompts()) {
    createWorkerTab();
  }
  checkAllComplete();
  broadcastState();
});
