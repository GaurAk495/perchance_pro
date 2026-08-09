import { describe, expect, test } from 'bun:test';
import { disableFrom, togglePromptStatus, type PromptStatus } from './prompt-status.ts';

const all = (statuses: PromptStatus[]): PromptStatus[] => [...statuses];

describe('togglePromptStatus', () => {
  test('pending -> skipped', () => {
    const result = togglePromptStatus(all(['pending', 'pending', 'pending']), 1, true);
    expect(result).toEqual(['pending', 'skipped', 'pending']);
  });

  test('skipped -> pending', () => {
    const result = togglePromptStatus(all(['skipped', 'skipped']), 0, false);
    expect(result).toEqual(['pending', 'skipped']);
  });

  test('returns a new array, does not mutate the input', () => {
    const input = all(['pending', 'pending']);
    const result = togglePromptStatus(input, 0, true);
    expect(result).not.toBe(input);
    expect(input).toEqual(['pending', 'pending']);
  });

  test('processing is left unchanged', () => {
    const result = togglePromptStatus(all(['processing']), 0, true);
    expect(result).toEqual(['processing']);
  });

  test('completed is left unchanged', () => {
    const result = togglePromptStatus(all(['completed']), 0, false);
    expect(result).toEqual(['completed']);
  });

  test('failed is left unchanged', () => {
    const result = togglePromptStatus(all(['failed']), 0, true);
    expect(result).toEqual(['failed']);
  });

  test('out-of-range index is a no-op', () => {
    const result = togglePromptStatus(all(['pending']), 5, true);
    expect(result).toEqual(['pending']);
  });
});

describe('disableFrom', () => {
  test('disables all pending prompts from index onward', () => {
    const result = disableFrom(all(['pending', 'pending', 'pending', 'pending']), 1);
    expect(result).toEqual(['pending', 'skipped', 'skipped', 'skipped']);
  });

  test('leaves processing, completed, and failed untouched', () => {
    const result = disableFrom(
      all(['pending', 'processing', 'completed', 'pending', 'failed', 'pending']),
      0
    );
    expect(result).toEqual(['skipped', 'processing', 'completed', 'skipped', 'failed', 'skipped']);
  });

  test('no-op when nothing pending at or after the index', () => {
    const input = all(['completed', 'completed']);
    const result = disableFrom(input, 0);
    expect(result).toEqual(['completed', 'completed']);
  });

  test('returns a new array, does not mutate the input', () => {
    const input = all(['pending']);
    const result = disableFrom(input, 0);
    expect(result).not.toBe(input);
    expect(input).toEqual(['pending']);
  });

  test('from 0 disables every pending prompt', () => {
    const result = disableFrom(all(['pending', 'pending']), 0);
    expect(result).toEqual(['skipped', 'skipped']);
  });
});
