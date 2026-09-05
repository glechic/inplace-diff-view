import { Marker, MarkerAction } from './parser';

export type { MarkerAction };

/**
 * Apply one action to the single marker whose raw text matches raw,
 * within text. Raw match disambiguates identical markers; when several
 * markers share the same raw text, the FIRST occurrence after `fromHint`
 * is edited. Returns null when nothing matched.
 */
export function applyOne(
  text: string,
  markers: Marker[],
  raw: string,
  action: MarkerAction,
  fromHint = -1,
): { text: string; marker: Marker } | null {
  const candidates = markers.filter((m) => m.raw === raw && m.kind === (action === 'delete' ? 'note' : 'correction'));
  let target: Marker | undefined;
  if (fromHint >= 0) {
    target = candidates.find((m) => m.start >= fromHint) ?? candidates[candidates.length - 1];
  } else {
    target = candidates[0];
  }
  if (!target) return null;
  const edit = markerEdit(text, target, action);
  return {
    text: text.slice(0, edit.start) + edit.replacement + text.slice(edit.end),
    marker: target,
  };
}

/** Markers an action applies to: corrections for accept/reject, notes for delete. */
export function markersFor(action: MarkerAction, markers: Marker[]): Marker[] {
  return markers.filter((m) => (action === 'delete' ? m.kind === 'note' : m.kind === 'correction'));
}

/**
 * Compute the surgical replacement for one marker: the raw marker text is
 * replaced with the chosen side (accept → new, reject → old, delete → '').
 * When the replacement is empty and exactly one space follows the marker
 * (before a non-space), that space is consumed too so deletions don't
 * leave double spaces: "remove: {the|}." -> "remove: ."
 */
export function markerEdit(text: string, m: Marker, action: MarkerAction): { start: number; end: number; replacement: string } {
  const replacement = m.kind === 'correction' ? (action === 'accept' ? m.new : m.old) : '';
  let end = m.end;
  if (replacement === '' && text[end] === ' ' && text[end + 1] !== ' ' && text[end + 1] !== undefined) {
    end++;
  }
  return { start: m.start, end, replacement };
}