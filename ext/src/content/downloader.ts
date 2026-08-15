import type { ContentToBackgroundMessage, BackgroundToContentMessage } from '../shared/messages.ts';
import { createFilename } from '../shared/utils.ts';
import { getImageIframes, getOuterIframeDocument } from './dom.ts';
import { waitForImageSrc } from './wait.ts';
import { DEFAULTS } from '../shared/constants.ts';

export async function extractAndDownloadImages(promptIndex: number): Promise<number> {
  const iframes = getImageIframes();
  const dataUrls: string[] = [];

  for (let i = 0; i < iframes.length; i++) {
    try {
      const src = await waitForImageSrc(iframes[i]!);
      const resolved = await resolveImageSrc(src, promptIndex, i);
      if (resolved) dataUrls.push(resolved);
    } catch (error) {
      console.error(`Image ${i} extraction failed:`, error);
    }
  }

  if (dataUrls.length === 0) return 0;

  const images = dataUrls.map((dataUrl, i) => ({
    dataUrl,
    filename: createFilename(promptIndex, i),
  }));

  const success = await sendDownloadRequest(images);
  return success ? images.length : 0;
}

async function resolveImageSrc(
  src: string,
  promptIndex: number,
  imageIndex: number
): Promise<string | null> {
  if (src.startsWith('data:')) return src;

  if (src.startsWith('blob:')) {
    return await resolveBlobUrl(src);
  }

  if (src.startsWith('http://') || src.startsWith('https://')) {
    return await fetchRemoteImage(src);
  }

  console.warn(`Unsupported image src type: ${src.slice(0, 60)}`);
  return null;
}

async function resolveBlobUrl(blobUrl: string): Promise<string> {
  const outerDoc = getOuterIframeDocument();
  if (!outerDoc) throw new Error('Cannot access outer iframe document');

  const markerId = '_pp_blob_' + Math.random().toString(36).slice(2, 10);
  const marker = outerDoc.createElement('div');
  marker.id = markerId;
  marker.style.display = 'none';
  outerDoc.body.appendChild(marker);

  const scriptEl = outerDoc.createElement('script');
  scriptEl.textContent = `
    (async()=>{
      try {
        const r=await fetch(${JSON.stringify(blobUrl)});
        const b=await r.blob();
        const rd=new FileReader();
        rd.onload=()=>{
          const el=document.getElementById(${JSON.stringify(markerId)});
          if(el) el.setAttribute('data-r',rd.result);
        };
        rd.readAsDataURL(b);
      } catch(e) {
        const el=document.getElementById(${JSON.stringify(markerId)});
        if(el) el.setAttribute('data-e',e.message);
      }
    })();
  `;
  outerDoc.body.appendChild(scriptEl);

  const start = Date.now();
  while (Date.now() - start < DEFAULTS.imageLoadTimeout) {
    await sleep(200);
    const result = marker.getAttribute('data-r');
    if (result) {
      marker.remove();
      return result;
    }
    const error = marker.getAttribute('data-e');
    if (error) {
      marker.remove();
      throw new Error(`Blob fetch failed: ${error}`);
    }
  }

  marker.remove();
  throw new Error('Blob URL resolution timed out');
}

async function fetchRemoteImage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching image`);
  }
  const blob = await response.blob();
  return await blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
    reader.readAsDataURL(blob);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function sendDownloadRequest(
  images: readonly { dataUrl: string; filename: string }[]
): Promise<boolean> {
  const message: ContentToBackgroundMessage = {
    type: 'DOWNLOAD_IMAGES',
    images,
  };

  return new Promise<boolean>((resolve) => {
    chrome.runtime.sendMessage(message, (response: BackgroundToContentMessage | undefined) => {
      if (chrome.runtime.lastError) {
        console.error('Download request error:', chrome.runtime.lastError);
        resolve(false);
        return;
      }
      resolve(response?.success ?? false);
    });
  });
}
