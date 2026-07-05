import { DEFAULTS, type FilenamePatternKey, FILENAME_PATTERN_LABELS } from '../shared/constants.ts';

// ─── Types ───

type TabName = 'dashboard' | 'settings' | 'logs';

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
  folderName: string;
  prefix: string;
  suffix: string;
  filenamePattern: FilenamePatternKey;
  perPromptFolders: boolean;
  logs: LogEntry[];
  workerStats: WorkerStat[];
  nextWorkerIndex: number;
}

// ─── DOM refs ───

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const tabs: { btn: HTMLButtonElement; panel: HTMLElement }[] = [];
let currentTab: TabName = 'dashboard';

// ─── State cache ───

let cachedState: AppState | null = null;
let currentFilter = 'all';

// ─── Init ───

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initDashboardActions();
  initSettingsForm();
  initLogActions();
  initImportExport();
  loadSettings();

  chrome.runtime.sendMessage({ action: 'GET_STATE' }, (state: AppState) => {
    if (state) {
      cachedState = state;
      renderAll(state);
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'STATE_UPDATED') {
      cachedState = msg.state as AppState;
      renderAll(msg.state as AppState);
    }
  });
});

// ─── Tab system ───

function initTabs(): void {
  const tabBar = document.getElementById('tab-bar')!;
  for (const btn of tabBar.querySelectorAll<HTMLButtonElement>('.tab-btn')) {
    const tabName = btn.dataset.tab as TabName;
    const panel = $(`${tabName}-panel`);
    tabs.push({ btn, panel });

    btn.addEventListener('click', () => switchTab(tabName));
  }
}

function switchTab(name: TabName): void {
  currentTab = name;
  for (const { btn, panel } of tabs) {
    btn.classList.toggle('active', btn.dataset.tab === name);
    panel.classList.toggle('active', panel.dataset.tab === name);
  }
}

// ─── Dashboard actions ───

function initDashboardActions(): void {
  $<HTMLButtonElement>('btn-start').addEventListener('click', handleStart);
  $<HTMLButtonElement>('btn-pause').addEventListener('click', handlePause);
  $<HTMLButtonElement>('btn-stop').addEventListener('click', handleStop);
}

function handleStart(): void {
  const textarea = $<HTMLTextAreaElement>('input-prompts');
  const prompts = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!prompts.length) return;

  chrome.runtime.sendMessage({
    action: 'START',
    prompts,
    numImages: readNumImages(),
    workerCount: readWorkerCount(),
    negativePrompt: $<HTMLTextAreaElement>('input-negative').value.trim(),
    folderName: $<HTMLInputElement>('input-folder').value.trim(),
    prefix: $<HTMLInputElement>('input-prefix').value.trim(),
    suffix: $<HTMLInputElement>('input-suffix').value.trim(),
    filenamePattern: $<HTMLSelectElement>('input-filename-pattern').value as FilenamePatternKey,
    perPromptFolders: $<HTMLInputElement>('input-per-prompt-folders').checked,
  });
}

function handlePause(): void {
  if (cachedState?.isPaused) {
    chrome.runtime.sendMessage({ action: 'RESUME' });
  } else {
    chrome.runtime.sendMessage({ action: 'PAUSE' });
  }
}

function handleStop(): void {
  chrome.runtime.sendMessage({ action: 'STOP' });
}

// ─── Settings ───

function initSettingsForm(): void {
  const inputs = ['input-workers', 'input-num-images', 'input-negative', 'input-folder', 'input-prefix', 'input-suffix', 'input-filename-pattern', 'input-per-prompt-folders'];
  for (const id of inputs) {
    $(id).addEventListener('change', saveSettings);
  }
}

function loadSettings(): void {
  chrome.storage.local.get(['settings'], (res) => {
    const s = res.settings as Record<string, string> | undefined;
    if (!s) return;
    if (s.workerCount) $<HTMLInputElement>('input-workers').value = s.workerCount;
    if (s.numImages) $<HTMLInputElement>('input-num-images').value = s.numImages;
    if (s.negativePrompt !== undefined) $<HTMLTextAreaElement>('input-negative').value = s.negativePrompt;
    if (s.folderName !== undefined) $<HTMLInputElement>('input-folder').value = s.folderName;
    if (s.prefix !== undefined) $<HTMLInputElement>('input-prefix').value = s.prefix;
    if (s.suffix !== undefined) $<HTMLInputElement>('input-suffix').value = s.suffix;
    if (s.filenamePattern) $<HTMLSelectElement>('input-filename-pattern').value = s.filenamePattern;
    if (s.perPromptFolders !== undefined) $<HTMLInputElement>('input-per-prompt-folders').checked = s.perPromptFolders === 'true';
  });
}

function saveSettings(): void {
  chrome.storage.local.set({
    settings: {
      workerCount: $<HTMLInputElement>('input-workers').value,
      numImages: $<HTMLInputElement>('input-num-images').value,
      negativePrompt: $<HTMLTextAreaElement>('input-negative').value,
      folderName: $<HTMLInputElement>('input-folder').value,
      prefix: $<HTMLInputElement>('input-prefix').value,
      suffix: $<HTMLInputElement>('input-suffix').value,
      filenamePattern: $<HTMLSelectElement>('input-filename-pattern').value,
      perPromptFolders: String($<HTMLInputElement>('input-per-prompt-folders').checked),
    },
  });
}

function readWorkerCount(): number {
  return parseInt($<HTMLInputElement>('input-workers').value, 10) || DEFAULTS.workerCount;
}

function readNumImages(): number {
  return parseInt($<HTMLInputElement>('input-num-images').value, 10) || 1;
}

// ─── Import / Export ───

function initImportExport(): void {
  $<HTMLButtonElement>('btn-import').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.csv';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        $<HTMLTextAreaElement>('input-prompts').value = text;
      };
      reader.readAsText(file);
    });
    input.click();
  });

  $<HTMLButtonElement>('btn-clear').addEventListener('click', () => {
    $<HTMLTextAreaElement>('input-prompts').value = '';
  });
}

// ─── Log actions ───

function initLogActions(): void {
  const filterBar = document.getElementById('log-filter-bar')!;
  for (const btn of filterBar.querySelectorAll<HTMLButtonElement>('.filter-btn[data-filter]')) {
    btn.addEventListener('click', () => {
      filterBar.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter!;
      if (cachedState) renderLogs(cachedState);
    });
  }

  $<HTMLButtonElement>('btn-clear-logs').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'CLEAR_LOGS' });
  });
}

// ─── Render ───

function renderAll(state: AppState): void {
  renderConnectionBadge(state);
  renderButtons(state);
  renderPromptList(state);
  renderLogs(state);
  renderStats(state);
  updatePauseButton(state);

  // Update textarea from state on start
  if (state.isRunning && $<HTMLTextAreaElement>('input-prompts').value.split('\n').filter(Boolean).length === 0) {
    $<HTMLTextAreaElement>('input-prompts').value = state.prompts.join('\n');
  }
}

function renderConnectionBadge(state: AppState): void {
  const badge = $('connection-badge');
  const online = state.workers.some(w => w.frameId !== null);
  badge.textContent = online ? '◉ Online' : '◉ Offline';
  badge.className = online ? 'online' : 'offline';
}

function renderButtons(state: AppState): void {
  const startBtn = $<HTMLButtonElement>('btn-start');
  const pauseBtn = $<HTMLButtonElement>('btn-pause');
  const stopBtn = $<HTMLButtonElement>('btn-stop');
  const importBtn = $<HTMLButtonElement>('btn-import');
  const clearBtn = $<HTMLButtonElement>('btn-clear');

  startBtn.disabled = state.isRunning;
  stopBtn.disabled = !state.isRunning;
  pauseBtn.disabled = !state.isRunning;
  importBtn.disabled = state.isRunning;
  clearBtn.disabled = state.isRunning;
}

function updatePauseButton(state: AppState): void {
  const pauseBtn = $<HTMLButtonElement>('btn-pause');
  pauseBtn.textContent = state.isPaused ? '▶ Resume' : '⏸ Pause';
}

function renderPromptList(state: AppState): void {
  const ul = $('prompt-list');
  const show = state.isRunning || state.promptStatuses.some(s => s !== 'pending');

  if (!show || state.prompts.length === 0) {
    ul.innerHTML = '';
    return;
  }

  const pendingCount = state.promptStatuses.filter(s => s === 'pending').length;
  const statusText = pendingCount > 0 ? `${state.currentIndex}/${state.prompts.length}` : `${state.prompts.length}/${state.prompts.length}`;

  ul.innerHTML = `<li style="font-size:10px;color:var(--text-dim);padding:4px 10px;border-bottom:1px solid var(--border);">${statusText}</li>` +
    state.prompts
      .map((p, i) => {
        const status = state.promptStatuses[i] || 'pending';
        const iconMap: Record<PromptStatus, string> = {
          pending: '○',
          processing: '◌',
          completed: '✓',
          failed: '✗',
        };
        const icon = iconMap[status] || '○';
        return `<li><span class="status-icon ${status}">${icon}</span><span class="prompt-num">${i + 1}.</span><span class="prompt-text">${escapeHtml(p)}</span></li>`;
      })
      .join('');
}

function renderLogs(state: AppState): void {
  const ul = $('log-list');

  let entries = [...state.logs];
  if (currentFilter !== 'all') {
    entries = entries.filter(e => e.type === currentFilter);
  }
  entries.reverse();

  if (entries.length === 0) {
    ul.innerHTML = '<li class="empty-state">No log entries yet.</li>';
    return;
  }

  ul.innerHTML = entries
    .map(e => {
      let cls = `log-${e.type}`;
      if (e.workerIndex !== undefined && e.workerIndex >= 0 && e.workerIndex <= 7) {
        cls += ` log-worker-${e.workerIndex}`;
      }
      const tag = e.workerIndex !== undefined ? `<span class="worker-tag wtag-${e.workerIndex}">w${e.workerIndex}</span>` : '';
      return `<li class="${cls}"><span class="log-text">${escapeHtml(e.text)}</span>${tag}</li>`;
    })
    .join('');
}

function renderStats(state: AppState): void {
  const panel = $('stats-panel');
  const stats = state.workerStats;

  if (!stats.length) {
    panel.innerHTML = '';
    return;
  }

  const totalPrompts = stats.reduce((a, s) => a + s.promptsCompleted, 0);
  const totalImages = stats.reduce((a, s) => a + s.imagesGenerated, 0);
  const totalErrors = stats.reduce((a, s) => a + s.errors, 0);

  const avgTimes = stats.map(s => ({
    workerIndex: s.workerIndex,
    avg: s.promptsCompleted > 0 ? s.totalTimeMs / s.promptsCompleted : 0,
  }));
  const maxAvg = Math.max(...avgTimes.map(a => a.avg), 1);

  const html = `
    <div class="stat-card">
      <span class="stat-label">Prompts</span>
      <span class="stat-value">${totalPrompts}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Images</span>
      <span class="stat-value">${totalImages}</span>
    </div>
    ${totalErrors > 0 ? `
    <div class="stat-card">
      <span class="stat-label">Errors</span>
      <span class="stat-value">${totalErrors}</span>
    </div>` : ''}
    ${avgTimes.map(a => {
      const pct = maxAvg > 0 ? (a.avg / maxAvg) * 100 : 0;
      return `
    <div class="stat-card">
      <span class="stat-label">W${a.workerIndex}</span>
      <div class="mini-chart">
        <div class="bar" style="width:${Math.max(pct, 10)}%">
          <div class="bar-fill" style="width:100%"></div>
        </div>
        <span class="stat-value">${(a.avg / 1000).toFixed(1)}s</span>
      </div>
    </div>`;
    }).join('')}
  `;

  panel.innerHTML = html;
}

// ─── Helpers ───

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
