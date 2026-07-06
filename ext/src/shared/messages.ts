import type { QueueConfig, ProgressEvent } from './types.ts';

export interface StartQueueMessage {
  readonly type: 'START_QUEUE';
  readonly config: QueueConfig;
}

export interface PauseQueueMessage {
  readonly type: 'PAUSE_QUEUE';
}

export interface ResumeQueueMessage {
  readonly type: 'RESUME_QUEUE';
}

export interface StopQueueMessage {
  readonly type: 'STOP_QUEUE';
}

export type SidebarCommand =
  StartQueueMessage | PauseQueueMessage | ResumeQueueMessage | StopQueueMessage;

export interface ProgressEventMessage {
  readonly type: 'PROGRESS_EVENT';
  readonly event: ProgressEvent;
}

export type ContentToSidebarMessage = ProgressEventMessage;

export interface ImageDownload {
  readonly dataUrl: string;
  readonly filename: string;
}

export interface DownloadImagesMessage {
  readonly type: 'DOWNLOAD_IMAGES';
  readonly images: readonly ImageDownload[];
}

export interface DownloadsCompleteMessage {
  readonly type: 'DOWNLOADS_COMPLETE';
  readonly success: boolean;
}

export type ContentToBackgroundMessage = DownloadImagesMessage;

export type BackgroundToContentMessage = DownloadsCompleteMessage;
