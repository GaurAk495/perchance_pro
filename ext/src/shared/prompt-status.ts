export type PromptStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export function togglePromptStatus(
  statuses: readonly PromptStatus[],
  index: number,
  skipped: boolean
): PromptStatus[] {
  if (index < 0 || index >= statuses.length) return [...statuses];
  const current = statuses[index];
  if (current !== 'pending' && current !== 'skipped') return [...statuses];
  const next: PromptStatus = skipped ? 'skipped' : 'pending';
  if (current === next) return [...statuses];
  const copy = [...statuses];
  copy[index] = next;
  return copy;
}

export function disableFrom(statuses: readonly PromptStatus[], from: number): PromptStatus[] {
  const copy = [...statuses];
  let changed = false;
  for (let i = from; i < copy.length; i++) {
    if (copy[i] === 'pending') {
      copy[i] = 'skipped';
      changed = true;
    }
  }
  return changed ? copy : statuses.slice();
}

export function enableFrom(statuses: readonly PromptStatus[], from: number): PromptStatus[] {
  const copy = [...statuses];
  let changed = false;
  for (let i = from; i < copy.length; i++) {
    if (copy[i] === 'skipped') {
      copy[i] = 'pending';
      changed = true;
    }
  }
  return changed ? copy : statuses.slice();
}
