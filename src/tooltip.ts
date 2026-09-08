import { setIcon } from 'obsidian';
import type { Marker, MarkerAction } from './parser';
import { classifyRaw } from './parser';

export interface TooltipHost {
  /** Apply accept/reject/delete to the marker rendered by this element. */
  applyAction(el: HTMLElement, action: MarkerAction): void;
}

/**
 * Hover tooltip for rendered diff markers.
 *
 * The parsed marker is reconstructed from data attributes on the element
 * (data-diff-raw), so the tooltip never depends on view state staying alive.
 *
 * Corrections show old -> new with [Accept new] [Keep old] buttons.
 * Notes show the text with a single [Delete note] button.
 */
export class MarkerTooltip {
  private tooltip: HTMLElement | null = null;
  private hideTimeout: number | null = null;
  private currentEl: HTMLElement | null = null;

  constructor(private host: TooltipHost) {}

  /** True when the element is inside the tooltip itself (don't treat as mouseleave). */
  contains(el: Element | null): boolean {
    return this.tooltip !== null && el !== null && this.tooltip.contains(el);
  }

  show(el: HTMLElement): void {
    const marker = classifyRaw(el.dataset.diffRaw ?? '');
    if (!marker) return;
    this.clearTimeout();
    if (!this.tooltip) this.build();
    const t = this.tooltip!;
    this.currentEl = el;
    t.empty();
    this.render(marker, t, el);
    t.classList.add('is-open');

    // Measure, then clamp below (or above) the element inside the viewport.
    t.setCssStyles({ visibility: 'hidden', left: '0px', top: '0px' });
    document.body.appendChild(t);
    const tw = t.offsetWidth;
    const th = t.offsetHeight;
    const margin = 6;
    const r = el.getBoundingClientRect();
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));
    let top = r.bottom + 8;
    if (top + th > window.innerHeight - margin) top = Math.max(margin, r.top - th - 8);
    t.setCssStyles({
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      visibility: 'visible',
    });
  }

  private build(): void {
    const t = document.body.createDiv({ cls: 'inplace-diff-tooltip' });
    // Cancel any pending hide when the pointer enters the tooltip, so
    // moving from the marker into the tooltip never closes it mid-move.
    t.addEventListener('mouseenter', () => this.clearTimeout());
    t.addEventListener('mouseleave', () => this.scheduleHide());
    this.tooltip = t;
  }

  private clearTimeout(): void {
    if (this.hideTimeout !== null) {
      window.clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  /** Delay hiding so moving the pointer into the tooltip keeps it open. */
  scheduleHide(): void {
    this.clearTimeout();
    this.hideTimeout = window.setTimeout(() => this.hide(), 200);
  }

  hide(): void {
    this.clearTimeout();
    if (this.tooltip) this.tooltip.classList.remove('is-open');
    this.currentEl = null;
  }

  private render(marker: Marker, t: HTMLElement, target: HTMLElement): void {
    const header = t.createDiv({ cls: 'inplace-diff-tooltip__header' });
    const chip = header.createSpan({ cls: 'inplace-diff-tooltip__chip' });
    if (marker.kind === 'note') {
      chip.addClass('is-note');
      setIcon(chip.createSpan({ cls: 'inplace-diff-tooltip__chip-icon' }), 'info');
      chip.createSpan({ text: 'Note' });
    } else {
      chip.addClass('is-correction');
      setIcon(chip.createSpan({ cls: 'inplace-diff-tooltip__chip-icon' }), 'diff');
      chip.createSpan({ text: 'Correction' });
    }

    if (marker.kind === 'note') {
      t.createDiv({ cls: 'inplace-diff-tooltip__note' }, (d) => {
        d.textContent = marker.text;
      });
      this.renderActions(t, target, [
        { action: 'delete', label: 'Delete note', cls: 'is-danger' },
      ]);
      return;
    }

    const corr = marker;
    const row = t.createDiv({ cls: 'inplace-diff-tooltip__row' });
    const oldSide = row.createDiv({ cls: 'inplace-diff-tooltip__side is-old' });
    if (corr.old) {
      oldSide.createDiv({ cls: 'inplace-diff-tooltip__label', text: 'Old' });
      oldSide.createDiv({ cls: 'inplace-diff-tooltip__value', text: corr.old });
    } else {
      oldSide.createDiv({ cls: 'inplace-diff-tooltip__label', text: 'Old' });
      oldSide.createDiv({ cls: 'inplace-diff-tooltip__value is-empty', text: '(nothing — insertion)' });
    }
    const arrow = row.createDiv({ cls: 'inplace-diff-tooltip__arrow' });
    setIcon(arrow, 'arrow-right');
    const newSide = row.createDiv({ cls: 'inplace-diff-tooltip__side is-new' });
    if (corr.new) {
      newSide.createDiv({ cls: 'inplace-diff-tooltip__label', text: 'New' });
      newSide.createDiv({ cls: 'inplace-diff-tooltip__value', text: corr.new });
    } else {
      newSide.createDiv({ cls: 'inplace-diff-tooltip__label', text: 'New' });
      newSide.createDiv({ cls: 'inplace-diff-tooltip__value is-empty', text: '(nothing — deletion)' });
    }

    this.renderActions(t, target, [
      { action: 'accept', label: 'Accept new', cls: 'is-accept' },
      { action: 'reject', label: 'Keep old', cls: 'is-reject' },
    ]);
  }

  private renderActions(t: HTMLElement, target: HTMLElement, buttons: { action: MarkerAction; label: string; cls: string }[]): void {
    const actions = t.createDiv({ cls: 'inplace-diff-tooltip__actions' });
    for (const b of buttons) {
      const btn = actions.createEl('button', {
        cls: `inplace-diff-tooltip__btn ${b.cls}`,
        text: b.label,
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
        this.host.applyAction(target, b.action);
      });
    }
  }
}