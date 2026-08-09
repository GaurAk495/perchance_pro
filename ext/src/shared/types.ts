export interface Prompt {
  text: string;
  negative?: string;
}

export interface QueueConfig {
  prompts: readonly Prompt[];
  negativePrompt: string;
  numImages: number;
}

export type QueueStatus = 'idle' | 'running' | 'paused' | 'stopped';

export type ProgressEvent =
  | { readonly type: 'STARTED' }
  | { readonly type: 'PROMPT_STARTED'; readonly promptIndex: number; readonly promptText: string }
  | { readonly type: 'GENERATION_STARTED'; readonly promptIndex: number }
  | { readonly type: 'WAITING'; readonly promptIndex: number }
  | { readonly type: 'DOWNLOADING'; readonly promptIndex: number; readonly imageIndex: number }
  | {
      readonly type: 'PROMPT_FINISHED';
      readonly promptIndex: number;
      readonly imagesDownloaded: number;
    }
  | { readonly type: 'QUEUE_FINISHED'; readonly totalImages: number }
  | { readonly type: 'ERROR'; readonly promptIndex: number; readonly message: string }
  | { readonly type: 'STATUS_CHANGE'; readonly status: QueueStatus }
  | { readonly type: 'PROGRESS'; readonly current: number; readonly total: number };
