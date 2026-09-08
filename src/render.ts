import { Marker, parseDoc } from './parser';

/** Split a text node's content into plain runs and markers, in order. */
type Piece = { kind: 'text'; value: string } | { kind: 'marker'; marker: Marker };

function pieces(text: string, markers: Marker[]): Piece[] {
  const out: Piece[] = [];
  let pos = 0;
  for (const m of markers) {
    if (m.start > pos) out.push({ kind: 'text', value: text.slice(pos, m.start) });
    out.push({ kind: 'marker', marker: m });
    pos = m.end;
  }
  if (pos < text.length) out.push({ kind: 'text', value: text.slice(pos) });
  return out;
}

/** Build the styled span for one marker (Reading view). */
export function buildMarkerEl(m: Marker): HTMLElement {
  const attr: Record<string, string> = { 'data-diff-kind': m.kind, 'data-diff-raw': m.raw };
  if (m.kind === 'note') {
    const span = createSpan({ cls: 'inplace-diff-note', attr });
    span.createSpan({ cls: 'inplace-diff-note__chip', text: 'note' });
    span.createSpan({ cls: 'inplace-diff-note__body', text: m.text });
    return span;
  }
  const style = !m.new ? 'delete' : m.old ? 'replace' : 'insert';
  const span = createSpan({ cls: 'inplace-diff-corr', attr: { ...attr, 'data-diff-style': style } });
  span.createSpan({ cls: 'inplace-diff-corr__old', text: m.old });
  span.createSpan({ cls: 'inplace-diff-corr__arrow', text: '→' });
  span.createSpan({ cls: 'inplace-diff-corr__new', text: m.new });
  return span;
}

/**
 * Wrap every marker found in text nodes under el (skipping code blocks and
 * already-wrapped markers). Used as a markdown post-processor.
 */
export function renderSection(el: HTMLElement): void {
  if (el.querySelector?.('.metadata-container')) return; // properties block
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    if (!parent) continue;
    if (parent.closest('pre, code, .metadata-container, .inplace-diff-corr, .inplace-diff-note')) continue;
    if (!(n.textContent ?? '').includes('{')) continue;
    nodes.push(n as Text);
  }
  for (const node of nodes) {
    const text = node.textContent ?? '';
    const markers = parseDoc(text);
    if (!markers.length) continue;
    const frag = createFragment();
    for (const p of pieces(text, markers)) {
      frag.appendChild(p.kind === 'text' ? document.createTextNode(p.value) : buildMarkerEl(p.marker));
    }
    node.parentNode?.replaceChild(frag, node);
  }
}