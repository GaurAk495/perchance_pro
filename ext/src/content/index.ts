console.log('Perchance Pro content script injected.');

const generatorArea = document.querySelector('#generatorArea');
if (generatorArea) generatorArea.remove();

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
        runPrompt(msg.prompt, msg.negativePrompt || '', msg.numImages || 1, msg.artStyle || '');
        sendResponse({ status: 'started' });
      }
    });
  }
}, 1000);

function runPrompt(
  promptText: string,
  negativePrompt: string,
  numImages: number,
  artStyle: string
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
    console.log('debug', artStyleSelect, artStyle);
    if (artStyleSelect) {
      artStyleSelect.value = artStyle;
      artStyleSelect.dispatchEvent(new Event('input', { bubbles: true }));
      artStyleSelect.dispatchEvent(new Event('change', { bubbles: true }));
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
        console.log('[Perchance Pro] Image ready, sending to background:', img.src);
        chrome.runtime.sendMessage({ action: 'IMAGE_READY', src: img.src });
      }
    }
  }
}, 500);
