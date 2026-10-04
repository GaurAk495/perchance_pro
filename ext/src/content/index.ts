import { CONTENT_WARNING } from '../shared/constants.ts';
import { attemptContentWarningAutofix } from './content-warning.ts';

const generatorArea = document.querySelector('#generatorArea');
if (generatorArea) generatorArea.remove();

// ─── Content-warning gate ───

let lastWarningState: boolean | null = null;

function currentWarningState(): boolean {
  for (const id of CONTENT_WARNING.containerIds) {
    const el = document.getElementById(id);
    if (!el) continue;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (el.offsetParent !== null || el.getClientRects().length > 0) return true;
  }
  return false;
}

setInterval(() => {
  const present = currentWarningState();
  if (present !== lastWarningState) {
    lastWarningState = present;
    chrome.runtime.sendMessage({
      action: present ? 'CONTENT_WARNING_PRESENT' : 'CONTENT_WARNING_CLEARED',
    });
  }
}, CONTENT_WARNING.pollIntervalMs);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'CMD_DISMISS_WARNING') {
    const result = attemptContentWarningAutofix();
    sendResponse({ status: 'attempted', detail: result });
    return true;
  }
  return false;
});

// ─── Controller Logic (runs in frame that has generateButtonEl) ───

let listenForRun = false;
const reportedImages = new Set<string>();

setInterval(() => {
  const btn = document.getElementById('generateButtonEl');
  if (btn && !listenForRun) {
    listenForRun = true;
    chrome.runtime.sendMessage({ action: 'REGISTER_CONTROLLER' });

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.action === 'CMD_RUN_PROMPT') {
        runPrompt(
          msg.prompt,
          msg.negativePrompt || '',
          msg.numImages || 1,
          msg.artStyle || '',
          msg.artStyleMix || '',
          msg.shape || ''
        );
        sendResponse({ status: 'started' });
      }
    });
  }
}, 1000);

function runPrompt(
  promptText: string,
  negativePrompt: string,
  numImages: number,
  artStyle: string,
  artStyleMix: string,
  shape: string
): void {
  const promptEl = document.querySelector<HTMLTextAreaElement>('textarea[data-name="description"]');
  if (promptEl) {
    promptEl.value = promptText;
    promptEl.dispatchEvent(new Event('input', { bubbles: true }));
    promptEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (negativePrompt) {
    const negEl = document.querySelector<HTMLTextAreaElement>('textarea[data-name="negative"]');
    if (negEl) {
      negEl.value = negativePrompt;
      negEl.dispatchEvent(new Event('input', { bubbles: true }));
      negEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  const numInput = document.querySelector<HTMLInputElement>('input[data-name="numImages"]');
  if (numInput) {
    numInput.value = String(numImages);
    numInput.dispatchEvent(new Event('input', { bubbles: true }));
    numInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (artStyle) {
    const artStyleSelect = document.querySelector<HTMLSelectElement>(
      'select[data-name="artStyle"]'
    );
    if (artStyleSelect) {
      artStyleSelect.value = artStyle;
      artStyleSelect.dispatchEvent(new Event('input', { bubbles: true }));
      artStyleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  if (artStyleMix) {
    const mixSelect = document.querySelector<HTMLSelectElement>('select[data-name="artStyleMix"]');
    if (mixSelect) {
      mixSelect.value = artStyleMix;
      mixSelect.dispatchEvent(new Event('input', { bubbles: true }));
      mixSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  if (shape) {
    const shapeSelect = document.querySelector<HTMLSelectElement>('select[data-name="shape"]');
    if (shapeSelect) {
      shapeSelect.value = shape;
      shapeSelect.dispatchEvent(new Event('input', { bubbles: true }));
      shapeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  const outputArea = document.getElementById('outputAreaEl');
  if (outputArea) outputArea.innerHTML = '';
  reportedImages.clear();

  chrome.runtime.sendMessage({
    action: 'EXPECT_IMAGES',
    count: numImages,
    prompt: promptText,
  });

  const btn = document.getElementById('generateButtonEl') as HTMLButtonElement | null;
  if (btn) btn.click();
}

// ─── Image Extraction (runs in ALL frames via all_frames: true) ───

setInterval(() => {
  const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img#resultImgEl'));
  for (const img of imgs) {
    if (
      img.src &&
      img.complete &&
      img.naturalHeight !== 0 &&
      !img.src.includes('loading') &&
      img.naturalHeight > 50 &&
      img.naturalWidth > 50
    ) {
      if (!reportedImages.has(img.src)) {
        reportedImages.add(img.src);
        chrome.runtime.sendMessage({ action: 'IMAGE_READY', src: img.src });
      }
    }
  }
}, 500);
