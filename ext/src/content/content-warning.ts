import { CONTENT_WARNING } from '../shared/constants.ts';
import { isContentWarningVisible } from './dom.ts';

function findClickableByText(needles: readonly string[]): HTMLElement | null {
  const selectors = 'button, a, input[type="button"], input[type="submit"], [role="button"]';
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(selectors));
  // Also consider plain text nodes wrapped in <p>/<span>/<div> that Perchance makes clickable
  const textContainers = Array.from(document.querySelectorAll<HTMLElement>('p, span, div, label'));
  const all = [...candidates, ...textContainers];
  for (const needle of needles) {
    const lower = needle.toLowerCase();
    for (const el of all) {
      const text = (el.textContent ?? '').trim().toLowerCase();
      if (text.length > 0 && text.length < 80 && text.includes(lower)) {
        // Prefer the most specific (shortest) match
        return el;
      }
    }
  }
  return null;
}

function setSelectToWarn(): boolean {
  const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('select'));
  let changed = false;
  for (const select of selects) {
    const options = Array.from(select.options);
    const warnIdx = options.findIndex(
      (o) => /warn/i.test(o.textContent ?? '') || /warn/i.test(o.value)
    );
    if (warnIdx >= 0) {
      select.selectedIndex = warnIdx;
      select.value = options[warnIdx]?.value ?? select.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      changed = true;
    }
  }
  return changed;
}

function checkOver18(): boolean {
  const labels = Array.from(document.querySelectorAll('label'));
  for (const label of labels) {
    if (/over\s*18/i.test(label.textContent ?? '')) {
      const forId = label.getAttribute('for');
      let box: HTMLInputElement | null = null;
      if (forId) box = document.getElementById(forId) as HTMLInputElement | null;
      if (!box) box = label.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (!box) {
        const prev = label.previousElementSibling?.querySelector?.('input[type="checkbox"]');
        if (prev instanceof HTMLInputElement) box = prev;
      }
      if (!box) {
        const all = Array.from(
          document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
        );
        // Fallback: checkbox nearest to the label
        box = all[0] ?? null;
      }
      if (box && !box.checked) {
        box.click();
        box.dispatchEvent(new Event('input', { bubbles: true }));
        box.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      if (box?.checked) return true;
    }
  }
  // Fallback: check any unchecked checkbox near warning copy
  const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  for (const box of boxes) {
    if (!box.checked) {
      box.click();
      return true;
    }
  }
  return boxes.length > 0;
}

function getWarningElementIfPresent(): HTMLElement | null {
  for (const id of CONTENT_WARNING.containerIds) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

export function attemptContentWarningAutofix(): string {
  if (!isContentWarningVisible() && !getWarningElementIfPresent()) {
    return 'no-warning';
  }
  const steps: string[] = [];

  // 1. Open "change preferences" if present
  const pref = findClickableByText(['change preferences', 'change preference']);
  if (pref) {
    pref.click();
    steps.push('preferences-opened');
  }

  // 2. Select "Warn" from dropdown
  if (setSelectToWarn()) steps.push('warn-selected');

  // 3. Check "I am over 18"
  if (checkOver18()) steps.push('over18-checked');

  // 4. Click OK / Save
  let okBtn: HTMLElement | null = null;
  const btns = Array.from(
    document.querySelectorAll<HTMLElement>('button, input[type="button"], input[type="submit"]')
  );
  for (const b of btns) {
    const t = (b.textContent ?? (b as HTMLInputElement).value ?? '').trim().toLowerCase();
    if (t === 'ok' || t === 'save' || t === 'confirm' || t === 'apply') {
      okBtn = b;
      break;
    }
  }
  if (okBtn) {
    okBtn.click();
    steps.push('ok-clicked');
  }

  // 5. Final "I am over 18 years - show content" button lives outside the prefs modal
  const show = findClickableByText([
    'show content',
    'i am over 18',
    'i’m over 18',
    'view content',
    'continue',
    'proceed',
  ]);
  // Avoid re-clicking the prefs checkbox label; require a button-like element for final step
  if (show && /button|a|input/i.test(show.tagName)) {
    // Defer slightly so prefs save first
    window.setTimeout(() => show.click(), 400);
    steps.push('show-clicked');
  } else if (show) {
    window.setTimeout(() => show.click(), 400);
    steps.push('show-clicked');
  }

  return steps.length > 0 ? steps.join(',') : 'no-action';
}
