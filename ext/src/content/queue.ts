import type { Prompt, QueueConfig, QueueStatus, ProgressEvent } from '../shared/types.ts';
import { DEFAULTS } from '../shared/constants.ts';
import { sleep } from '../shared/utils.ts';

export type ProgressListener = (event: ProgressEvent) => void;

export class Queue {
  private _status: QueueStatus = 'idle';
  private _prompts: readonly Prompt[] = [];
  private _negativePrompt = '';
  private _numImages = 1;
  private _currentIndex = 0;
  private _aborted = false;
  private _paused = false;
  private _pauseResolver: (() => void) | null = null;
  private _listeners: Set<ProgressListener> = new Set();

  constructor(
    private readonly _processPrompt: (
      prompt: Prompt,
      index: number,
      numImages: number,
      negativePrompt: string,
    ) => Promise<void>,
  ) {}

  get status(): QueueStatus {
    return this._status;
  }

  on(listener: ProgressListener): void {
    this._listeners.add(listener);
  }

  off(listener: ProgressListener): void {
    this._listeners.delete(listener);
  }

  private _emit(event: ProgressEvent): void {
    for (const listener of this._listeners) {
      try {
        listener(event);
      } catch {
        // Silently ignore listener errors
      }
    }
  }

  async start(config: QueueConfig): Promise<void> {
    if (this._status === 'running') return;

    this._prompts = config.prompts;
    this._negativePrompt = config.negativePrompt;
    this._numImages = config.numImages;
    this._currentIndex = 0;
    this._aborted = false;
    this._paused = false;
    this._status = 'running';

    this._emit({ type: 'STARTED' });
    this._emit({ type: 'STATUS_CHANGE', status: 'running' });

    const total = this._prompts.length;

    for (let i = 0; i < total; i++) {
      if (this._aborted) break;

      await this._checkPause();

      this._currentIndex = i;
      const prompt = this._prompts[i]!;

      this._emit({ type: 'PROMPT_STARTED', promptIndex: i, promptText: prompt.text });
      this._emit({ type: 'PROGRESS', current: i, total });

      try {
        await this._withRetry(() =>
          this._processPrompt(prompt, i, this._numImages, this._negativePrompt),
        );
        this._emit({ type: 'PROMPT_FINISHED', promptIndex: i, imagesDownloaded: this._numImages });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Prompt ${i} failed:`, message);
        this._emit({ type: 'ERROR', promptIndex: i, message });
      }
    }

    if (!this._aborted) {
      this._status = 'idle';
      this._emit({ type: 'QUEUE_FINISHED', totalImages: this._numImages * this._prompts.length });
      this._emit({ type: 'STATUS_CHANGE', status: 'idle' });
    }
  }

  pause(): void {
    if (this._status !== 'running') return;
    this._status = 'paused';
    this._paused = true;
    this._emit({ type: 'STATUS_CHANGE', status: 'paused' });
  }

  resume(): void {
    if (this._status !== 'paused') return;
    this._status = 'running';
    this._paused = false;
    this._pauseResolver?.();
    this._pauseResolver = null;
    this._emit({ type: 'STATUS_CHANGE', status: 'running' });
  }

  stop(): void {
    this._aborted = true;
    this._paused = false;
    this._pauseResolver?.();
    this._pauseResolver = null;

    if (this._status === 'running' || this._status === 'paused') {
      this._status = 'stopped';
      this._emit({ type: 'STATUS_CHANGE', status: 'stopped' });
    }
  }

  private async _checkPause(): Promise<void> {
    if (!this._paused) return;
    return new Promise<void>((resolve) => {
      this._pauseResolver = resolve;
    });
  }

  private async _withRetry<T>(fn: () => Promise<T>, retries: number = DEFAULTS.maxRetries): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < retries - 1) {
          await sleep(1000 * (attempt + 1));
        }
      }
    }

    throw lastError;
  }
}
