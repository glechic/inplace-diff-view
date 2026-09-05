/**
 * Parser for writing-inplace-diff markers.
 *
 * Marker forms (single line only):
 *   {old | new}   correction — "old" matches the original text, "new" is the fix.
 *                 Empty old side = insertion {|new}; empty new side = deletion {old|}.
 *   {note|text}   observation — left side is exactly "note" (no space).
 *
 * Outer whitespace on each side is trimmed, because the spaces surrounding the
 * marker in the sentence belong to the prose, not the replacement:
 *   "for {a half | half a} year" -> reject gives "for a half year", not a double space.
 *
 * Markers containing a newline, or a top-level '|' on the right side
 * (markdown tables use |), are rejected and left as raw text.
 */

export interface Correction {
  kind: 'correction';
  /** Document offset of '{'. */
  start: number;
  /** Document offset just past '}'. */
  end: number;
  old: string;
  new: string;
  /** 0-based source line (set by parseDoc). */
  line: number;
  raw: string;
}

export interface Note {
  kind: 'note';
  start: number;
  end: number;
  text: string;
  line: number;
  raw: string;
}

export type Marker = Correction | Note;

export type MarkerAction = 'accept' | 'reject' | 'delete';

/** One opening brace with balanced single-level nesting, on a single line. */
const BRACES_RE = /^{(?:[^{}]|{[^{}]*})*}/;
/** Opening or closing code fence: ``` or ~~~ (3+, up to 3 spaces indent). */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/** Index of the first '|' at brace-depth 0, or -1. */
function topLevelBar(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '|' && depth === 0) return i;
  }
  return -1;
}

/**
 * Parse a single marker from its raw text (e.g. "{old | new}").
 * Exported for the tooltip, which re-parses data-diff-raw attributes.
 */
export function classifyRaw(raw: string): Marker | null {
  let inner = raw;
  if (inner.startsWith('{') && inner.endsWith('}')) inner = inner.slice(1, -1);
  const parsed = classify(inner);
  return parsed ? ({ ...parsed, raw, start: 0, end: raw.length, line: -1 } as Marker) : null;
}

function classify(inner: string): Omit<Correction, 'start' | 'end' | 'line' | 'raw'> | Omit<Note, 'start' | 'end' | 'line' | 'raw'> | null {
  if (inner.includes('\n')) return null;
  const bar = topLevelBar(inner);
  if (bar === -1) return null;
  const left = inner.slice(0, bar);
  let right = inner.slice(bar + 1);
  if (topLevelBar(right) !== -1) return null; // ambiguous / markdown table row
  if (left === 'note') return { kind: 'note', text: right.trim() };
  // Un-escape a table-style pipe: {a \| b} -> old "a", new "b"
  if (right.startsWith('\\')) right = right.slice(1);
  const old = left.trim();
  const replacement = right.trim();
  if (old === replacement) return null; // trivial marker {I | I} — leave raw
  return { kind: 'correction', old, new: replacement };
}

/**
 * Parse markers on one line.
 * @param line   the line text
 * @param offset document offset of the line start
 * @param lineNo 0-based line number to stamp on markers (optional)
 */
export function parseLine(line: string, offset: number, lineNo?: number): Marker[] {
  const out: Marker[] = [];
  let i = 0;
  const n = line.length;
  while (i < n) {
    const brace = line.indexOf('{', i);
    if (brace === -1) break;
    const m = BRACES_RE.exec(line.slice(brace));
    if (!m) {
      i = brace + 1;
      continue;
    }
    const raw = m[0];
    const parsed = classify(raw.slice(1, -1));
    if (parsed) {
      out.push({ ...parsed, raw, line: lineNo ?? -1, start: offset + brace, end: offset + brace + raw.length } as Marker);
      i = brace + raw.length;
    } else {
      i = brace + 1;
    }
  }
  return out;
}

/**
 * Parse all markers in a document, skipping YAML frontmatter and fenced code
 * blocks. Returns markers sorted by document offset.
 */
export function parseDoc(text: string): Marker[] {
  const out: Marker[] = [];
  const lines = text.split('\n');
  let inFrontmatter = lines.length > 0 && lines[0]?.trim() === '---';
  let fence = ''; // '' = not in fence; otherwise the fence marker (``` or ~~~)
  let offset = 0;
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx] as string;
    const lineStart = offset;
    offset += line.length + 1;
    if (inFrontmatter) {
      if (idx > 0 && line.trim() === '---') inFrontmatter = false;
      continue;
    }
    const fm = FENCE_RE.exec(line);
    if (fence !== '') {
      if (fm && fm[1]?.[0] === fence) fence = '';
      continue;
    } else if (fm) {
      fence = fm[1]?.[0] ?? '';
      continue;
    }
    out.push(...parseLine(line, lineStart, idx));
  }
  return out;
}