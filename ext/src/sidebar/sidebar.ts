import { DEFAULTS, ART_STLYE, type FilenamePatternKey } from '../shared/constants.ts';
import { parsePromptList, promptsToText, type PromptListFormat } from '../shared/prompt-parser.ts';
import type { PromptStatus } from '../shared/prompt-status.ts';
import type { Prompt } from '../shared/types.ts';
import { googleSignIn, signOut, getAuthState, setAuthPremium } from '../auth/auth-manager.ts';
import { refreshPremium } from '../auth/premium-checker.ts';

// ─── Types ───

type TabName = 'dashboard' | 'settings' | 'logs';

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
  prompts: Prompt[];
  currentIndex: number;
  isRunning: boolean;
  isPaused: boolean;
  negativePrompt: string;
  numImages: number;
  workerCount: number;
  artStyle: string;
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
  runStartedAt: number;
}

interface AuthUser {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly photoURL: string;
}

interface AuthState {
  user: AuthUser | null;
  premium: boolean;
}

// ─── DOM refs ───

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const tabs: { btn: HTMLButtonElement; panel: HTMLElement }[] = [];
let currentTab: TabName = 'dashboard';

// ─── State cache ───

let cachedState: AppState | null = null;
let currentFilter = 'all';
let currentFormat: PromptListFormat = 'text';
let statsTimer: ReturnType<typeof setInterval> | null = null;

// ─── Init ───

async function initAuth(): Promise<void> {
  const authState = await getAuthState();

  showAuthScreen(authState);

  const loginBtn = document.getElementById('btn-google-signin');
  if (loginBtn) {
    loginBtn.addEventListener('click', handleGoogleSignIn);
  }

  const signOutBtn = document.getElementById('btn-signout');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', handleSignOut);
  }

  const signOutUpsellBtn = document.getElementById('btn-signout-upsell');
  if (signOutUpsellBtn) {
    signOutUpsellBtn.addEventListener('click', handleSignOut);
  }

  const refreshBtn = document.getElementById('btn-refresh-premium');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', handleRefreshPremium);
  }
}

function showAuthScreen(authState: AuthState): void {
  const loginScreen = document.getElementById('auth-login');
  const dashboardScreen = document.getElementById('auth-dashboard');
  const premiumBanner = document.getElementById('premium-banner');
  const loginBtn = document.getElementById('btn-google-signin') as HTMLButtonElement | null;

  if (!loginScreen || !dashboardScreen) return;

  loginScreen.style.display = 'none';
  dashboardScreen.style.display = 'none';

  if (!authState.user) {
    loginScreen.style.display = 'flex';
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign in with Google';
    }
  } else {
    dashboardScreen.style.display = 'flex';
    populateUserBar(authState.user, authState.premium);
    if (premiumBanner) {
      premiumBanner.style.display = authState.premium ? 'none' : 'flex';
    }
  }
}

function populateUpsell(user: AuthUser): void {
  const avatar = document.getElementById('upsell-avatar') as HTMLImageElement | null;
  const name = document.getElementById('upsell-name');
  if (avatar && user.photoURL) {
    avatar.src = user.photoURL;
    avatar.style.display = 'block';
  }
  if (name) {
    name.textContent = user.displayName || user.email;
  }
}

function populateUserBar(user: AuthUser, premium: boolean): void {
  const avatar = document.getElementById('user-avatar') as HTMLImageElement | null;
  const name = document.getElementById('user-name');
  const badge = document.getElementById('user-premium-badge');
  if (avatar && user.photoURL) {
    avatar.src = user.photoURL;
  }
  if (name) {
    name.textContent = user.displayName || user.email;
  }
  if (badge) {
    badge.style.display = premium ? 'inline-flex' : 'none';
  }
}

async function handleGoogleSignIn(): Promise<void> {
  const btn = document.getElementById('btn-google-signin') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Signing in...';
  }

  try {
    const authState = await googleSignIn();
    showAuthScreen(authState);
  } catch {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Sign in with Google';
    }
  }
}

async function handleSignOut(): Promise<void> {
  await signOut();
  showAuthScreen({ user: null, premium: false });
}

async function handleRefreshPremium(): Promise<void> {
  const btn = document.getElementById('btn-refresh-premium') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;

  const current = await getAuthState();
  if (current.user) {
    const premium = await refreshPremium(current.user.uid);
    await setAuthPremium(premium);
    const updated = await getAuthState();
    showAuthScreen(updated);
  }

  if (btn) btn.disabled = false;
}

document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  initTabs();
  initDashboardActions();
  initSettingsForm();
  initLogActions();
  initImportExport();
  initPromptListActions();
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

async function handleStart(): Promise<void> {
  const textarea = $<HTMLTextAreaElement>('input-prompts');
  const prompts = parsePromptList(textarea.value, currentFormat);
  if (!prompts.length) return;

  const authState = await getAuthState();
  if (!authState.premium) {
    const banner = document.getElementById('premium-banner');
    if (banner) {
      banner.style.display = 'flex';
      banner.scrollIntoView({ behavior: 'smooth' });
    }
    return;
  }

  chrome.runtime.sendMessage({
    action: 'START',
    prompts,
    numImages: readNumImages(),
    workerCount: readWorkerCount(),
    artStyle: $<HTMLSelectElement>('input-art-style-dashboard').value,
    negativePrompt: $<HTMLTextAreaElement>('input-negative-dashboard').value.trim(),
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
  const artStyleSelect = $<HTMLSelectElement>('input-art-style-dashboard');
  for (const style of ART_STLYE) {
    const opt = document.createElement('option');
    opt.value = style.value;
    opt.textContent = style.label;
    if (style.label === '𝗡𝗼 𝘀𝘁𝘆𝗹𝗲') {
      opt.selected = true;
    }

    artStyleSelect.appendChild(opt);
  }

  const inputs = [
    'input-workers',
    'input-num-images-dashboard',
    'input-art-style-dashboard',
    'input-negative-dashboard',
    'input-folder',
    'input-prefix',
    'input-suffix',
    'input-filename-pattern',
    'input-per-prompt-folders',
  ];
  for (const id of inputs) {
    $(id).addEventListener('change', saveSettings);
  }
}

function loadSettings(): void {
  chrome.storage.local.get(['settings'], (res) => {
    const s = res.settings as Record<string, string> | undefined;
    if (!s) return;
    if (s.workerCount) $<HTMLSelectElement>('input-workers').value = s.workerCount;
    if (s.numImages) $<HTMLInputElement>('input-num-images-dashboard').value = s.numImages;
    if (s.artStyle !== undefined)
      $<HTMLSelectElement>('input-art-style-dashboard').value = s.artStyle;
    if (s.negativePrompt !== undefined)
      $<HTMLTextAreaElement>('input-negative-dashboard').value = s.negativePrompt;
    if (s.folderName !== undefined) $<HTMLInputElement>('input-folder').value = s.folderName;
    if (s.prefix !== undefined) $<HTMLInputElement>('input-prefix').value = s.prefix;
    if (s.suffix !== undefined) $<HTMLInputElement>('input-suffix').value = s.suffix;
    if (s.filenamePattern) $<HTMLSelectElement>('input-filename-pattern').value = s.filenamePattern;
    if (s.perPromptFolders !== undefined)
      $<HTMLInputElement>('input-per-prompt-folders').checked = s.perPromptFolders === 'true';
  });
}

function saveSettings(): void {
  chrome.storage.local.set({
    settings: {
      workerCount: $<HTMLSelectElement>('input-workers').value,
      numImages: $<HTMLInputElement>('input-num-images-dashboard').value,
      artStyle: $<HTMLSelectElement>('input-art-style-dashboard').value,
      negativePrompt: $<HTMLTextAreaElement>('input-negative-dashboard').value,
      folderName: $<HTMLInputElement>('input-folder').value,
      prefix: $<HTMLInputElement>('input-prefix').value,
      suffix: $<HTMLInputElement>('input-suffix').value,
      filenamePattern: $<HTMLSelectElement>('input-filename-pattern').value,
      perPromptFolders: String($<HTMLInputElement>('input-per-prompt-folders').checked),
    },
  });
}

function readWorkerCount(): number {
  return parseInt($<HTMLSelectElement>('input-workers').value, 10) || DEFAULTS.workerCount;
}

function readNumImages(): number {
  return parseInt($<HTMLInputElement>('input-num-images-dashboard').value, 10) || 1;
}

// ─── Import / Export ───

function initImportExport(): void {
  const textarea = $<HTMLTextAreaElement>('input-prompts');

  textarea.addEventListener('input', () => {
    chrome.storage.local.set({ savedPrompts: textarea.value });
  });

  $<HTMLButtonElement>('btn-import').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.csv';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const format: PromptListFormat = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'text';
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        currentFormat = format;
        textarea.value = text;
        chrome.storage.local.set({ savedPrompts: text, savedPromptsFormat: format });
      };
      reader.readAsText(file);
    });
    input.click();
  });

  $<HTMLButtonElement>('btn-clear').addEventListener('click', () => {
    textarea.value = '';
    $('prompt-list').innerHTML = '';
    chrome.storage.local.set({ savedPrompts: '' });
    chrome.runtime.sendMessage({ action: 'CLEAR' });
  });

  chrome.storage.local.get(['savedPrompts', 'savedPromptsFormat'], (res) => {
    if (res.savedPrompts) {
      textarea.value = res.savedPrompts as string;
    }
    if (res.savedPromptsFormat === 'csv') {
      currentFormat = 'csv';
    } else {
      currentFormat = 'text';
    }
  });
}

// ─── Log actions ───

function initLogActions(): void {
  const filterBar = document.getElementById('log-filter-bar')!;
  for (const btn of filterBar.querySelectorAll<HTMLButtonElement>('.filter-btn[data-filter]')) {
    btn.addEventListener('click', () => {
      filterBar
        .querySelectorAll('.filter-btn[data-filter]')
        .forEach((b) => b.classList.remove('active'));
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

  if (state.isRunning && !statsTimer) {
    statsTimer = setInterval(() => {
      if (cachedState) renderStats(cachedState);
    }, 1000);
  } else if (!state.isRunning && statsTimer) {
    clearInterval(statsTimer);
    statsTimer = null;
  }

  // Update textarea from state on start
  if (
    state.isRunning &&
    $<HTMLTextAreaElement>('input-prompts').value.split('\n').filter(Boolean).length === 0
  ) {
    $<HTMLTextAreaElement>('input-prompts').value = promptsToText(state.prompts);
  }
}

function renderConnectionBadge(state: AppState): void {
  const badge = $('connection-badge');
  const online = state.workers.some((w) => w.frameId !== null);
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

  const formElements = document.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >('#tab-content input, #tab-content textarea, #tab-content select');
  for (const el of formElements) {
    el.disabled = state.isRunning;
  }
}

function updatePauseButton(state: AppState): void {
  const pauseBtn = $<HTMLButtonElement>('btn-pause');
  pauseBtn.textContent = state.isPaused ? '▶ Resume' : '⏸ Pause';
}

function renderPromptList(state: AppState): void {
  const ul = $('prompt-list');
  const show = state.isRunning || state.promptStatuses.some((s) => s !== 'pending');

  if (!show || state.prompts.length === 0) {
    ul.innerHTML = '';
    return;
  }

  const pendingCount = state.promptStatuses.filter((s) => s === 'pending').length;
  const statusText =
    pendingCount > 0
      ? `${state.currentIndex}/${state.prompts.length}`
      : `${state.prompts.length}/${state.prompts.length}`;

  ul.innerHTML =
    `<li style="font-size:10px;color:var(--text-dim);padding:4px 10px;border-bottom:1px solid var(--border);">${statusText}</li>` +
    state.prompts
      .map((p, i) => {
        const status = state.promptStatuses[i] || 'pending';
        const iconMap: Record<PromptStatus, string> = {
          pending: '○',
          processing: '◌',
          completed: '✓',
          failed: '✗',
          skipped: '⊘',
        };
        const icon = iconMap[status] || '○';
        const wIdx = state.promptWorkers?.[i];
        const tag =
          wIdx !== undefined && wIdx !== null
            ? `<span class="worker-tag wtag-${wIdx}" style="font-size: 8px; padding: 0.5px 3.5px; border-radius: 2px;">w${wIdx}</span>`
            : '';
        const negative =
          p.negative !== undefined
            ? `<div class="prompt-negative">⛔ ${escapeHtml(p.negative)}</div>`
            : '';
        const toggleable = state.isRunning && (status === 'pending' || status === 'skipped');
        const checkbox = `<input type="checkbox" class="prompt-enable" ${status === 'skipped' ? '' : 'checked'} ${toggleable ? '' : 'disabled'} />`;
        const skipBtn =
          state.isRunning && status === 'pending'
            ? '<button class="prompt-skip-btn" title="Disable this prompt and all pending prompts after it">⏭ disable from here</button>'
            : '';
        const rowClass = status === 'skipped' ? ' class="skipped"' : '';
        return `<li data-index="${i}"${rowClass}>${checkbox}<span class="status-icon ${status}">${icon}</span><span class="prompt-num">${i + 1}.</span><span class="prompt-text">${escapeHtml(p.text)}</span>${skipBtn}${tag}${negative}</li>`;
      })
      .join('');
}

function initPromptListActions(): void {
  const list = $('prompt-list');

  list.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (!target.classList.contains('prompt-enable')) return;
    const li = target.closest('li');
    const index = Number(li?.getAttribute('data-index'));
    if (li === null || Number.isNaN(index)) return;
    chrome.runtime.sendMessage({
      action: 'SET_PROMPT_SKIPPED',
      index,
      skipped: !target.checked,
    });
  });

  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn || !btn.classList.contains('prompt-skip-btn')) return;
    const li = btn.closest('li');
    const index = Number(li?.getAttribute('data-index'));
    if (li === null || Number.isNaN(index)) return;
    chrome.runtime.sendMessage({ action: 'DISABLE_PROMPTS_FROM', index });
  });
}

function renderLogs(state: AppState): void {
  const ul = $('log-list');

  let entries = [...state.logs];
  if (currentFilter !== 'all') {
    entries = entries.filter((e) => e.type === currentFilter);
  }
  entries.reverse();

  if (entries.length === 0) {
    ul.innerHTML = '<li class="empty-state">No log entries yet.</li>';
    return;
  }

  ul.innerHTML = entries
    .map((e) => {
      let cls = `log-${e.type}`;
      if (e.workerIndex !== undefined && e.workerIndex >= 0 && e.workerIndex <= 7) {
        cls += ` log-worker-${e.workerIndex}`;
      }
      const tag =
        e.workerIndex !== undefined
          ? `<span class="worker-tag wtag-${e.workerIndex}">w${e.workerIndex}</span>`
          : '';
      return `<li class="${cls}"><span class="log-text">${escapeHtml(e.text)}</span>${tag}</li>`;
    })
    .join('');
}

function renderStats(state: AppState): void {
  const panel = $('stats-panel');
  const stats = state.workerStats;
  const totalPrompts = state.prompts.length;
  const completedPrompts = state.promptStatuses.filter((s) => s === 'completed').length;
  const failedPrompts = state.promptStatuses.filter((s) => s === 'failed').length;

  if (!stats.length && !state.isRunning && completedPrompts === 0) {
    panel.innerHTML = '';
    return;
  }

  const totalImages = stats.reduce((a, s) => a + s.imagesGenerated, 0);
  const totalErrors = stats.reduce((a, s) => a + s.errors, 0);
  const totalTimeMs = stats.reduce((a, s) => a + s.totalTimeMs, 0);
  const elapsed = state.runStartedAt > 0 ? Date.now() - state.runStartedAt : 0;
  const avgPerPrompt = completedPrompts > 0 ? totalTimeMs / completedPrompts : 0;
  const avgPerImage = totalImages > 0 ? totalTimeMs / totalImages : 0;

  let fastestWorker: { idx: number; avg: number } | null = null;
  let slowestWorker: { idx: number; avg: number } | null = null;
  for (const s of stats) {
    if (s.promptsCompleted === 0) continue;
    const avg = s.totalTimeMs / s.promptsCompleted;
    if (!fastestWorker || avg < fastestWorker.avg) fastestWorker = { idx: s.workerIndex, avg };
    if (!slowestWorker || avg > slowestWorker.avg) slowestWorker = { idx: s.workerIndex, avg };
  }

  const maxPrompts = Math.max(...stats.map((s) => s.promptsCompleted), 1);

  const overviewHtml = `
    <div class="stats-overview">
      <div class="stat-tile">
        <span class="stat-tile-icon">&#9201;</span>
        <div class="stat-tile-body">
          <span class="stat-tile-value">${formatDuration(elapsed)}</span>
          <span class="stat-tile-label">Elapsed</span>
        </div>
      </div>
      <div class="stat-tile">
        <span class="stat-tile-icon">&#10003;</span>
        <div class="stat-tile-body">
          <span class="stat-tile-value">${completedPrompts}/${totalPrompts}</span>
          <span class="stat-tile-label">Prompts</span>
        </div>
      </div>
      <div class="stat-tile">
        <span class="stat-tile-icon">&#128444;</span>
        <div class="stat-tile-body">
          <span class="stat-tile-value">${totalImages}</span>
          <span class="stat-tile-label">Images</span>
        </div>
      </div>
      ${
        totalErrors > 0
          ? `<div class="stat-tile stat-tile-error">
        <span class="stat-tile-icon">&#10007;</span>
        <div class="stat-tile-body">
          <span class="stat-tile-value">${totalErrors}</span>
          <span class="stat-tile-label">Errors</span>
        </div>
      </div>`
          : ''
      }
    </div>`;

  const workerHtml = stats
    .map((s) => {
      const avg = s.promptsCompleted > 0 ? s.totalTimeMs / s.promptsCompleted : 0;
      const pct = maxPrompts > 0 ? (s.promptsCompleted / maxPrompts) * 100 : 0;
      return `
      <div class="worker-row">
        <span class="worker-row-label">W${s.workerIndex}</span>
        <div class="worker-row-bar">
          <div class="worker-row-fill" style="width:${Math.max(pct, 4)}%"></div>
        </div>
        <span class="worker-row-stat">${s.promptsCompleted} prompts</span>
        <span class="worker-row-stat">${(avg / 1000).toFixed(1)}s avg</span>
        ${s.errors > 0 ? `<span class="worker-row-stat worker-row-err">${s.errors} err</span>` : ''}
      </div>`;
    })
    .join('');

  const timingHtml = `
    <div class="timing-grid">
      <div class="timing-item">
        <span class="timing-label">Avg / prompt</span>
        <span class="timing-value">${(avgPerPrompt / 1000).toFixed(1)}s</span>
      </div>
      <div class="timing-item">
        <span class="timing-label">Avg / image</span>
        <span class="timing-value">${(avgPerImage / 1000).toFixed(1)}s</span>
      </div>
      ${
        fastestWorker
          ? `<div class="timing-item">
        <span class="timing-label">Fastest worker</span>
        <span class="timing-value"><span class="timing-sub">W${fastestWorker.idx}</span> ${(fastestWorker.avg / 1000).toFixed(1)}s</span>
      </div>`
          : ''
      }
      ${
        slowestWorker && slowestWorker.idx !== fastestWorker?.idx
          ? `<div class="timing-item">
        <span class="timing-label">Slowest worker</span>
        <span class="timing-value"><span class="timing-sub">W${slowestWorker.idx}</span> ${(slowestWorker.avg / 1000).toFixed(1)}s</span>
      </div>`
          : ''
      }
    </div>`;

  panel.innerHTML = `
    <div class="section-label">Overview</div>
    ${overviewHtml}
    <div class="section-label">Worker Performance</div>
    <div class="worker-stats">${workerHtml || '<div class="empty-state">No worker data yet.</div>'}</div>
    <div class="section-label">Timing</div>
    ${timingHtml}
  `;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

// ─── Helpers ───

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
