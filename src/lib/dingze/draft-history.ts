// Undo / redo for the draft being edited. Keystrokes within a short burst collapse into one
// step so undo goes back a word or an edit, not a single character.

export type DraftHistory<T> = { past: T[]; present: T; future: T[]; lastAt: number };

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 800;

export function initHistory<T>(value: T): DraftHistory<T> {
  return { past: [], present: value, future: [], lastAt: 0 };
}

export function recordDraft<T>(h: DraftHistory<T>, next: T, now: number, coalesce = true): DraftHistory<T> {
  if (Object.is(next, h.present)) return h;
  const merge = coalesce && h.past.length > 0 && now - h.lastAt < COALESCE_MS;
  const past = merge ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastAt: now };
}

export function undoDraft<T>(h: DraftHistory<T>): DraftHistory<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], lastAt: 0 };
}

export function redoDraft<T>(h: DraftHistory<T>): DraftHistory<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), lastAt: 0 };
}
