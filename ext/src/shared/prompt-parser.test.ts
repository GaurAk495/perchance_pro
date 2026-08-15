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

describe('parsePromptList (inline | syntax)', () => {
  test('A castle | blurry → prompt + inline negative', () => {
    const result = parsePromptList('A castle | blurry', 'text');
    expect(result).toEqual([{ text: 'A castle', negative: 'blurry' }]);
  });

  test('first | splits; rest stays in the negative', () => {
    const result = parsePromptList('A castle | blurry | low quality', 'text');
    expect(result).toEqual([{ text: 'A castle', negative: 'blurry | low quality' }]);
  });

  test('pipe without surrounding spaces stays part of the prompt', () => {
    const result = parsePromptList('A|B castle', 'text');
    expect(result).toEqual([{ text: 'A|B castle' }]);
  });

  test('empty negative after | yields no negative', () => {
    const result = parsePromptList('A castle | ', 'text');
    expect(result).toEqual([{ text: 'A castle' }]);
  });

  test('inline negative merges with a following ! line', () => {
    const result = parsePromptList('A castle | blurry\n!low quality\nA dragon', 'text');
    expect(result).toEqual([
      { text: 'A castle', negative: 'blurry, low quality' },
      { text: 'A dragon' },
    ]);
  });

  test('inline negative merges with a following <negative> block', () => {
    const result = parsePromptList('A castle | blurry\n<negative>\nfog\n\nA dragon', 'text');
    expect(result).toEqual([{ text: 'A castle', negative: 'blurry, fog' }, { text: 'A dragon' }]);
  });

  test('inline negative lines coexist with plain lines in order', () => {
    const result = parsePromptList('A castle | blurry\nB dragon\nC forest | fog', 'text');
    expect(result).toEqual([
      { text: 'A castle', negative: 'blurry' },
      { text: 'B dragon' },
      { text: 'C forest', negative: 'fog' },
    ]);
  });

  test('space-bang-space splits inline too: prompt ! negative', () => {
    const result = parsePromptList('A castle ! blurry, low quality', 'text');
    expect(result).toEqual([{ text: 'A castle', negative: 'blurry, low quality' }]);
  });

  test('real pasted line: long prompt text + ! (negative list)', () => {
    const line =
      'The Urban Explorer: a cinematic wide shot on a 35mm lens ! (naked, nude, NSFW, sexy, bad anatomy, extra fingers, blurry, low quality)';
    expect(parsePromptList(line, 'text')).toEqual([
      {
        text: 'The Urban Explorer: a cinematic wide shot on a 35mm lens',
        negative: '(naked, nude, NSFW, sexy, bad anatomy, extra fingers, blurry, low quality)',
      },
    ]);
  });

  test('! separator wins over later | when both appear', () => {
    const result = parsePromptList('A castle ! blurry | more', 'text');
    expect(result).toEqual([{ text: 'A castle', negative: 'blurry | more' }]);
  });

  test('leading ! line still attaches to the previous prompt', () => {
    const result = parsePromptList('A castle\n!blurry\nA dragon', 'text');
    expect(result).toEqual([{ text: 'A castle', negative: 'blurry' }, { text: 'A dragon' }]);
  });

  test('trailing " !" with no negative yields no negative', () => {
    const result = parsePromptList('A castle !', 'text');
    expect(result).toEqual([{ text: 'A castle' }]);
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

  test('single-line negatives serialize inline and re-parse identically', () => {
    const original = parsePromptList(
      'A castle | blurry\nA dragon | extra fingers\nA forest',
      'text'
    );
    const serialized = promptsToText(original);
    expect(serialized).toContain('A castle | blurry');
    expect(serialized).toContain('A dragon | extra fingers');
    expect(parsePromptList(serialized, 'text')).toEqual(original);
  });

  test('multi-line prompts still serialize via <negative> block', () => {
    const original = [{ text: 'A castle\non a hill', negative: 'blurry, low quality' }];
    const serialized = promptsToText(original);
    expect(serialized).toBe('A castle\non a hill\n<negative>\nblurry, low quality');
    expect(parsePromptList(serialized, 'text')).toEqual(original);
  });
});
