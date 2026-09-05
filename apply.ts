import { Marker, MarkerAction } from './parser';

export type { MarkerAction };

/**
 * Apply an action to every matching marker in the document text and return
 * the new text. Markers are applied right-to-left so earlier offsets stay
 * valid while we splice.
 *
 * accept: correction -> new side (notes are ignored)
 * reject: correction -> old side (notes are ignored)
 * delete: note       -> removed  (corrections are ignored)
 *
 * When the replacement is empty (deletion or note removal) and the marker
 * is followed by a single space, that space is consumed too, so
 * "remove: {the|}." becomes "remove: ." and not "remove:  .".
 */
export function applyAllMarkers(text: string, markers: Marker[], action: MarkerAction): string {
  const relevant = markers.filter((m) =>
    action === 'delete' ? m.kind === 'note' : m.kind === 'correction',
  );
  let out = text;
  // Right-to-left so offsets of yet-unapplied markers are unaffected.
  for (let i = relevant.length - 1; i >= 0; i--) {
    const m = relevant[i];
    const replacement = m.kind === 'correction' ? (action === 'accept' ? m.new : m.old) : '';
    out = spliceMarker(out, m, replacement);
  }
  return out;
}

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
  const replacement = target.kind === 'correction' ? (action === 'accept' ? target.new : target.old) : '';
  return {
    text: spliceMarker(text, target, replacement),
    marker: target,
  };
}

/**
 * Replace one marker's raw text with `replacement`. If the replacement is
 * empty and exactly one space follows the marker (before a non-space),
 * consume that space too so deletions don't leave double spaces.
 */
function spliceMarker(text: string, m: Marker, replacement: string): string {
  let end = m.end;
  if (replacement === '' && text[end] === ' ' && text[end + 1] !== ' ' && text[end + 1] !== undefined) {
    end++;
  }
  return text.slice(0, m.start) + replacement + text.slice(end);
}