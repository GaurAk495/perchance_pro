export function zeroPad(num: number, length: number = 3): string {
  return String(num).padStart(length, "0");
}

export function createFilename(
  promptIndex: number,
  imageIndex: number,
): string {
  return `${zeroPad(promptIndex + 1)}_${zeroPad(imageIndex + 1)}.jpg`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
