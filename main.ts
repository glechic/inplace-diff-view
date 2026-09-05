import { Editor, MarkdownView, Plugin, TFile } from 'obsidian';
import { MarkerAction, parseDoc } from './parser';
import { applyAllMarkers, applyOne } from './apply';
import { MarkerTooltip } from './tooltip';
import { renderSection } from './render';
import { livePreviewExtension } from './livepreview';

/**
 * In-place Diff View — renders {old | new} / {note|...} markers from the
 * writing-inplace-diff workflow in Obsidian's Reading view, with a hover
 * tooltip to accept/reject each change.
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

  /** Tooltip button clicked: rewrite the file with the one change applied. */
  private async onTooltipAction(el: HTMLElement, action: MarkerAction): Promise<void> {
    const raw = el.dataset.diffRaw ?? '';
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile)) return;
    const text = await this.app.vault.read(file);
    const markers = parseDoc(text);
    const result = applyOne(text, markers, raw, action);
    if (!result) return;
    await this.writeWithEditor(file, result.text);
  }

  /**
   * Write new full text through the active editor (single undoable
   * transaction) when the file is open in source/live-preview mode, else
   * vault.modify.
   */
  private async writeWithEditor(file: TFile, newText: string): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view && view.file === file && view.getMode() === 'source') {
      const len = view.editor.getValue().length;
      view.editor.transaction({
        changes: [{ from: view.editor.offsetToPos(0), to: view.editor.offsetToPos(len), text: newText }],
      });
    } else {
      await this.app.vault.modify(file, newText);
    }
  }

  private applyToEditor(editor: Editor, action: MarkerAction): void {
    const text = editor.getValue();
    const markers = parseDoc(text);
    if (!markers.length) return;
    editor.transaction({
      changes: [{ from: editor.offsetToPos(0), to: editor.offsetToPos(text.length), text: applyAllMarkers(text, markers, action) }],
    });
  }
}