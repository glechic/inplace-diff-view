import { Editor, MarkdownView, Plugin, TFile } from 'obsidian';
import { MarkerAction, parseDoc } from './parser';
import { markerEdit, markersFor, applyOne } from './apply';
import { MarkerTooltip } from './tooltip';
import { renderSection } from './render';
import { livePreviewExtension } from './livepreview';

/**
 * In-place Diff View — renders {old | new} / {note|...} markers from the
 * writing-inplace-diff workflow in Obsidian's Reading view and Live Preview,
 * with a hover tooltip to accept, reject, or delete each change.
 */
export default class InplaceDiffPlugin extends Plugin {
  private tooltip: MarkerTooltip | null = null;

  async onload(): Promise<void> {
    this.tooltip = new MarkerTooltip({
      applyAction: (el, action) => void this.onTooltipAction(el, action),
    });

    this.registerMarkdownPostProcessor((el) => renderSection(el));
    this.registerEditorExtension(livePreviewExtension());

    // Hover drives the tooltip lifecycle: entering a marker shows it;
    // entering anything else schedules a hide (cancelled if the pointer
    // reaches the tooltip in time, so its buttons stay clickable). This
    // also self-heals the case where a marker's DOM is rebuilt under the
    // cursor (Live Preview re-renders), which misses mouseout entirely —
    // the next mouseover anywhere still hides the tooltip.
    this.registerDomEvent(document, 'mouseover', (evt) => {
      const target = evt.target as HTMLElement;
      const marker = target?.closest?.('.inplace-diff-corr, .inplace-diff-note');
      if (marker) {
        this.tooltip?.show(marker as HTMLElement);
      } else if (!target?.closest?.('.inplace-diff-tooltip')) {
        this.tooltip?.scheduleHide();
      }
    });
    this.registerDomEvent(document, 'mouseout', (evt) => {
      const from = (evt.target as HTMLElement)?.closest?.('.inplace-diff-corr, .inplace-diff-note');
      if (from && !this.tooltip?.contains((evt.relatedTarget as Element | null))) {
        this.tooltip?.scheduleHide();
      }
    });
    // Scrolling slides content under the fixed-position tooltip: close it.
    this.registerDomEvent(document, 'wheel', (evt) => {
      if (!(evt.target as HTMLElement)?.closest?.('.inplace-diff-tooltip')) this.tooltip?.hide();
    }, { passive: true });
    this.registerDomEvent(document, 'click', (evt) => {
      if (!(evt.target as HTMLElement)?.closest?.('.inplace-diff-tooltip')) this.tooltip?.hide();
    });
    this.registerDomEvent(document, 'keydown', (evt) => {
      if (evt.key === 'Escape') this.tooltip?.hide();
    });

    this.addCommand({
      id: 'accept-all',
      name: 'Accept all corrections',
      editorCallback: (editor) => this.applyToEditor(editor, 'accept'),
    });
    this.addCommand({
      id: 'reject-all',
      name: 'Keep original text for all corrections',
      editorCallback: (editor) => this.applyToEditor(editor, 'reject'),
    });
    this.addCommand({
      id: 'delete-all-notes',
      name: 'Delete all notes',
      editorCallback: (editor) => this.applyToEditor(editor, 'delete'),
    });
  }

  /**
   * Tooltip button clicked: apply the action to the file owning the
   * marker. Uses the active editor when the file is open in it (surgical,
   * undoable transaction); otherwise the atomic vault.process.
   */
  private async onTooltipAction(el: HTMLElement, action: MarkerAction): Promise<void> {
    const raw = el.dataset.diffRaw ?? '';
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile)) return;

    // Prefer the editor: a surgical transaction preserves the cursor and
    // selection, and stays on the editor's undo stack.
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view && view.file === file) {
      const editor = view.editor;
      const text = editor.getValue();
      const markers = parseDoc(text);
      const result = applyOne(text, markers, raw, action);
      if (!result) return;
      const target = result.marker;
      const edit = markerEdit(text, target, action);
      editor.transaction({
        changes: [{ from: editor.offsetToPos(edit.start), to: editor.offsetToPos(edit.end), text: edit.replacement }],
      });
      return;
    }

    // File not open in an editor (e.g. Reading view only): atomic write.
    await this.app.vault.process(file, (text) => {
      const markers = parseDoc(text);
      const result = applyOne(text, markers, raw, action);
      return result ? result.text : text;
    });
  }

  /**
   * Accept/reject/delete every relevant marker in the editor via one
   * transaction with one change per marker (right-to-left so offsets stay
   * valid). The cursor and all other content are untouched.
   */
  private applyToEditor(editor: Editor, action: MarkerAction): void {
    const text = editor.getValue();
    const markers = parseDoc(text);
    const relevant = markersFor(action, markers);
    if (!relevant.length) return;
    const changes = relevant
      .map((m) => markerEdit(text, m, action))
      .sort((a, b) => b.start - a.start)
      .map((edit) => ({
        from: editor.offsetToPos(edit.start),
        to: editor.offsetToPos(edit.end),
        text: edit.replacement,
      }));
    editor.transaction({ changes });
  }
}