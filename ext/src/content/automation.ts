import type { Prompt } from "../shared/types.ts";
import {
  getPromptBox,
  getNegativePromptBox,
  getNumImagesInput,
  getGenerateButton,
  setFieldValue,
  clickButton,
} from "./dom.ts";
import { waitForElement, waitForImageCount } from "./wait.ts";
import { extractAndDownloadImages } from "./downloader.ts";

export async function processPrompt(
  prompt: Prompt,
  promptIndex: number,
  numImages: number,
  negativePrompt: string,
): Promise<void> {
  const promptBox = await waitForElement(getPromptBox);
  setFieldValue(promptBox, prompt.text);

  const negativeBox = getNegativePromptBox();
  if (negativeBox && negativePrompt) {
    setFieldValue(negativeBox, negativePrompt);
  }

  const numInput = getNumImagesInput();
  if (numInput) {
    setFieldValue(numInput, String(numImages));
  }

  const generateButton = await waitForElement(getGenerateButton);

  await waitForImageCount(numImages);

  const downloaded = await extractAndDownloadImages(promptIndex);
  if (downloaded !== numImages) {
    console.warn(
      `Prompt ${promptIndex}: expected ${numImages} images, downloaded ${downloaded}`,
    );
  }
}
