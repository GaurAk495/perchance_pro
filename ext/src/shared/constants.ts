export const IFRAME_ID = 'outputIframeEl';

export const SELECTORS = {
  prompt: 'textarea.paragraph-input[data-name="description"]',
  negative: 'textarea.paragraph-input[data-name="negative"]',
  numImages: 'input.text-input[data-name="numImages"]',
  generateButton: 'button#generateButtonEl',
  outputArea: 'div#outputAreaEl',
  imageIframe: 'iframe.text-to-image-plugin-image-iframe',
  resultImg: 'img#resultImgEl',
} as const satisfies Record<string, string>;

export const STORAGE_KEYS = {
  negativePrompt: 'negativePrompt',
  numImages: 'numImages',
  prompts: 'prompts',
  folderName: 'folderName',
  prefix: 'prefix',
  suffix: 'suffix',
  workerCount: 'workerCount',
} as const satisfies Record<string, string>;

export const FILENAME_PATTERNS = {
  prompt_text_image_idx: '{prompt_text}_{image_idx}',
  prompt_idx_image_idx: '{prompt_idx}_{image_idx}',
  timestamp_image_idx: '{timestamp}_{image_idx}',
  prompt_idx_prompt_text_image_idx: '{prompt_idx}_{prompt_text}_{image_idx}',
} as const satisfies Record<string, string>;

export type FilenamePatternKey = keyof typeof FILENAME_PATTERNS;

export const FILENAME_PATTERN_LABELS: Record<FilenamePatternKey, string> = {
  prompt_text_image_idx: '{prompt_text}_{image_idx}',
  prompt_idx_image_idx: '{prompt_idx}_{image_idx}',
  timestamp_image_idx: '{timestamp}_{image_idx}',
  prompt_idx_prompt_text_image_idx: '{prompt_idx}_{prompt_text}_{image_idx}',
};

export const DEFAULTS = {
  numImages: 1,
  maxRetries: 3,
  pollInterval: 500,
  maxPollTime: 120000,
  imageLoadTimeout: 30000,
  workerCount: 2,
  workerCreateTimeout: 20000,
  saveAs: false,
  filenamePattern: 'prompt_text_image_idx' as FilenamePatternKey,
  perPromptFolders: false,
  foregroundDwellMs: 3000,
} as const;
