import { describe, expect, test } from 'bun:test';
import { parsePromptList, promptsToText } from './prompt-parser.ts';

describe('parsePromptList (text format)', () => {
  test('plain list: one prompt per line, no negatives', () => {
    const result = parsePromptList('A castle\nA dragon\nA forest', 'text');
    expect(result).toEqual([{ text: 'A castle' }, { text: 'A dragon' }, { text: 'A forest' }]);
  });

  test('blank lines are ignored in a plain list', () => {
    const result = parsePromptList('A castle\n\nA dragon\n\n', 'text');
    expect(result).toEqual([{ text: 'A castle' }, { text: 'A dragon' }]);
  });

  test('! line attaches to the previous prompt', () => {
    const result = parsePromptList('A castle\n!blurry, low quality\nA dragon', 'text');
    expect(result).toEqual([
      { text: 'A castle', negative: 'blurry, low quality' },
      { text: 'A dragon' },
    ]);
  });

  test('multiple ! lines merge with ", "', () => {
    const result = parsePromptList('A castle\n!blurry\n!low quality', 'text');
    expect(result).toEqual([{ text: 'A castle', negative: 'blurry, low quality' }]);
  });

  test('a leading ! line is dropped', () => {
    const result = parsePromptList('!blurry\nA castle', 'text');
    expect(result).toEqual([{ text: 'A castle' }]);
  });

  test('<negative> block: multi-line main + joined negative', () => {
    const result = parsePromptList(
      'A castle\non a hill\n<negative>\nblurry\nlow quality\n\nA dragon',
      'text'
    );
    expect(result).toEqual([
      { text: 'A castle\non a hill', negative: 'blurry, low quality' },
      { text: 'A dragon' },
    ]);
  });

  test('<negative> without a following blank line swallows until EOF', () => {
    const result = parsePromptList('A castle\n<negative>\nblurry\nmore blurry', 'text');
    expect(result).toEqual([{ text: 'A castle', negative: 'blurry, more blurry' }]);
  });

  test('blank line before <negative> attaches to last emitted prompt', () => {
    const result = parsePromptList('A castle\n\n<negative>\nblurry', 'text');
    expect(result).toEqual([{ text: 'A castle', negative: 'blurry' }]);
  });

  test('mixed !, <negative>, and plain lines in one list', () => {
    const result = parsePromptList(
      'A castle\n!blurry\n\nA dragon\non wings\n<negative>\ndeformed\n\nA forest\n<negative>\nfog',
      'text'
    );
    expect(result).toEqual([
      { text: 'A castle', negative: 'blurry' },
      { text: 'A dragon\non wings', negative: 'deformed' },
      { text: 'A forest', negative: 'fog' },
    ]);
  });

  test('CRLF line endings are handled', () => {
    const result = parsePromptList('A castle\r\n!blurry\r\nA dragon', 'text');
    expect(result).toEqual([{ text: 'A castle', negative: 'blurry' }, { text: 'A dragon' }]);
  });
});

describe('parsePromptList (csv format)', () => {
  test('second column becomes the negative', () => {
    const result = parsePromptList('A castle,blurry\nA dragon,extra fingers', 'csv');
    expect(result).toEqual([
      { text: 'A castle', negative: 'blurry' },
      { text: 'A dragon', negative: 'extra fingers' },
    ]);
  });

  test('quoted fields may contain commas', () => {
    const result = parsePromptList(
      '"A castle, on a hill",blurry\nA dragon,"extra fingers, hands"',
      'csv'
    );
    expect(result).toEqual([
      { text: 'A castle, on a hill', negative: 'blurry' },
      { text: 'A dragon', negative: 'extra fingers, hands' },
    ]);
  });

  test('escaped quotes inside quoted fields', () => {
    const result = parsePromptList('"A ""mighty"" castle",blurry', 'csv');
    expect(result).toEqual([{ text: 'A "mighty" castle', negative: 'blurry' }]);
  });

  test('missing second column yields no negative', () => {
    const result = parsePromptList('A castle\nA dragon,extra fingers', 'csv');
    expect(result).toEqual([{ text: 'A castle' }, { text: 'A dragon', negative: 'extra fingers' }]);
  });

  test('blank rows are skipped', () => {
    const result = parsePromptList('\nA castle,blurry\n\nA dragon,extra fingers\n', 'csv');
    expect(result).toEqual([
      { text: 'A castle', negative: 'blurry' },
      { text: 'A dragon', negative: 'extra fingers' },
    ]);
  });
});

describe('promptsToText round-trip', () => {
  test('re-parsing the serialized output yields the same list', () => {
    const original = parsePromptList(
      'A castle\non a hill\n<negative>\nblurry\nlow quality\n\nA dragon\n!extra fingers\nA forest',
      'text'
    );
    const reparsed = parsePromptList(promptsToText(original), 'text');
    expect(reparsed).toEqual(original);
  });
});
