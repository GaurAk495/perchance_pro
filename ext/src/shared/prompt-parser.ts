import type { Prompt } from './types.ts';

export const NEGATIVE_MARKER = '<negative>';
export const NEGATIVE_PREFIX = '!';

export type PromptListFormat = 'text' | 'csv';

export function parsePromptList(text: string, format: PromptListFormat): Prompt[] {
  return format === 'csv' ? parseCsvPrompts(text) : parseTextPrompts(text);
}

export function promptsToText(prompts: readonly Prompt[]): string {
  return prompts
    .map((p) => {
      const negative = p.negative ? `\n${NEGATIVE_MARKER}\n${p.negative}` : '';
      return `${p.text}${negative}`;
    })
    .join('\n\n');
}

function parseTextPrompts(text: string): Prompt[] {
  const prompts: Prompt[] = [];
  let group: string[] = [];
  let negLines: string[] | null = null;

  const lastPrompt = (): Prompt | undefined => prompts[prompts.length - 1];

  const flushGroupAsIndividuals = (): void => {
    for (const line of group) prompts.push({ text: line });
    group = [];
  };

  const endNegativeBlock = (): void => {
    const neg = negLines!.filter((l) => l.length > 0).join(', ');
    negLines = null;
    const p = lastPrompt();
    if (p && neg) p.negative = p.negative ? `${p.negative}, ${neg}` : neg;
  };

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();

    if (negLines !== null) {
      if (line === '') {
        endNegativeBlock();
      } else {
        negLines.push(line);
      }
      continue;
    }

    if (line === NEGATIVE_MARKER) {
      if (group.length > 0) {
        prompts.push({ text: group.join('\n') });
        group = [];
      }
      negLines = [];
      continue;
    }

    if (line.startsWith(NEGATIVE_PREFIX)) {
      if (group.length > 0) {
        prompts.push(...group.map((l) => ({ text: l })));
        group = [];
      }
      const neg = line.slice(NEGATIVE_PREFIX.length).trim();
      const p = lastPrompt();
      if (p && neg) p.negative = p.negative ? `${p.negative}, ${neg}` : neg;
      continue;
    }

    if (line === '') {
      flushGroupAsIndividuals();
      continue;
    }

    group.push(line);
  }

  flushGroupAsIndividuals();
  if (negLines !== null) endNegativeBlock();

  return prompts;
}

function parseCsvPrompts(text: string): Prompt[] {
  const prompts: Prompt[] = [];
  for (const row of parseCsvRows(text)) {
    const main = (row[0] ?? '').trim();
    if (!main) continue;
    const negative = (row[1] ?? '').trim();
    prompts.push(negative ? { text: main, negative } : { text: main });
  }
  return prompts;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = (): void => {
    row.push(field);
    field = '';
  };

  const pushRow = (): void => {
    pushField();
    if (row.some((f) => f.length > 0)) {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n') {
      pushRow();
    } else if (ch === '\r') {
      // skip carriage returns
    } else {
      field += ch;
    }
  }
  pushRow();

  return rows;
}
