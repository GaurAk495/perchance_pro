import { DEFAULTS } from '../shared/constants.ts';
import { sleep } from '../shared/utils.ts';
import { getImageIframes } from './dom.ts';

export async function waitForElement<T extends Element>(
  getter: () => T | null,
  timeout: number = DEFAULTS.maxPollTime,
  interval: number = DEFAULTS.pollInterval,
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const element = getter();
    if (element) return element;
    await sleep(interval);
  }
  throw new Error(`waitForElement: not found within ${timeout}ms`);
}

export async function waitForImageCount(
  expectedCount: number,
  timeout: number = DEFAULTS.maxPollTime,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const images = getImageIframes();
    if (images.length >= expectedCount) return;
    await sleep(DEFAULTS.pollInterval);
  }
  const actual = getImageIframes().length;
  throw new Error(`waitForImageCount: expected ${expectedCount}, found ${actual}`);
}

export async function waitForImageSrc(
  imageIframe: HTMLIFrameElement,
  timeout: number = DEFAULTS.imageLoadTimeout,
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const srcdoc = imageIframe.srcdoc;
    if (srcdoc) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(srcdoc, 'text/html');
      const img = doc.querySelector('img');
      if (img?.src) return img.src;
    }

    const src = imageIframe.src;
    if (src && src !== 'about:blank') {
      return src;
    }

    await sleep(DEFAULTS.pollInterval);
  }
  throw new Error('waitForImageSrc: no image source found within timeout');
}
