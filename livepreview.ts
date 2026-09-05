import { Extension } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { Marker, parseDoc } from './parser';
import { buildMarkerEl } from './render';

/** Live-Preview widget that draws a marker as old → new styled spans. */
class DiffMarkerWidget extends WidgetType {
  constructor(readonly marker: Marker) {
    super();
  }

  eq(other: DiffMarkerWidget): boolean {
    return other.marker.raw === this.marker.raw;
  }

  toDOM(_view: EditorView): HTMLElement {
    return buildMarkerEl(this.marker);
  }

  // Let mouse events bubble so the delegated hover handler shows the tooltip.
  ignoreEvent(_event: Event): boolean {
    return false;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const text = view.state.doc.toString();
  const markers = parseDoc(text);
  if (markers.length === 0) return Decoration.none;
  const sel = view.state.selection.main;
  const visible = view.visibleRanges;
  const ranges: any[] = [];
  for (const m of markers) {
    // Skip while the selection touches the marker: expose raw text for editing.
    if (sel.from <= m.end && m.start <= sel.to) continue;
    let inView = false;
    for (const r of visible) {
      if (m.start < r.to && m.end > r.from) {
        inView = true;
        break;
      }
    }
    if (!inView) continue;
    ranges.push(Decoration.replace({ widget: new DiffMarkerWidget(m) }).range(m.start, m.end));
  }
  return ranges.length ? Decoration.set(ranges, true) : Decoration.none;
}

class DiffMarkerViewPlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildDecorations(view);
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = buildDecorations(update.view);
    }
  }
}

/** CM6 extension: replace raw marker text with styled widgets in Live Preview. */
export function livePreviewExtension(): Extension {
  return ViewPlugin.fromClass(DiffMarkerViewPlugin, {
    decorations: (v: DiffMarkerViewPlugin) => v.decorations,
  });
}