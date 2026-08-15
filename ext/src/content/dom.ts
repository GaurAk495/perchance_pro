import { IFRAME_ID, SELECTORS } from "../shared/constants.ts";

function getIframeDocument(): Document | null {
  const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
  if (!iframe) return null;
  console.log("iframe", iframe);
  return iframe.contentDocument ?? iframe.contentWindow?.document ?? null;
}

export function getOuterIframeDocument(): Document | null {
  return getIframeDocument();
}

function queryIframe<T extends Element>(selector: string): T | null {
  const doc = getIframeDocument();
  if (!doc) return null;
  return doc.querySelector<T>(selector);
}

export function getPromptBox(): HTMLTextAreaElement | null {
  return queryIframe<HTMLTextAreaElement>(SELECTORS.prompt);
}

export function getNegativePromptBox(): HTMLTextAreaElement | null {
  return queryIframe<HTMLTextAreaElement>(SELECTORS.negative);
}

export function getNumImagesInput(): HTMLInputElement | null {
  return queryIframe<HTMLInputElement>(SELECTORS.numImages);
}

export function getGenerateButton(): HTMLButtonElement | null {
  return queryIframe<HTMLButtonElement>(SELECTORS.generateButton);
}

export function getOutputArea(): HTMLElement | null {
  return queryIframe<HTMLElement>(SELECTORS.outputArea);
}

export function getImageIframes(): readonly HTMLIFrameElement[] {
  const doc = getIframeDocument();
  if (!doc) return [];
  const container = doc.querySelector(SELECTORS.outputArea);
  console.log("container", container);
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLIFrameElement>(SELECTORS.imageIframe),
  );
}

export function setFieldValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  const proto =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

  const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (nativeSetter) {
    nativeSetter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function clickButton(button: HTMLButtonElement): void {
  button.click();
}
