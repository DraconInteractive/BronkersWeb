import type { Card } from '../engine/card';
import type { Game } from '../engine/game';

type Options = {
  hand: HTMLElement;
  game: Game;
  node: (card: Card) => HTMLButtonElement | undefined;
  face: (card: Card) => HTMLElement;
  page: () => number;
  setPage: (page: number) => void;
  pageButton: (step: -1 | 1) => HTMLButtonElement;
};

type Gesture = {
  card: Card;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  originalIndex: number;
  originalPage: number;
  preview: HTMLElement | null;
  pageStep: -1 | 0 | 1;
  pageTimer?: number;
};

// Pointer events keep the same gesture behavior for touch, pen, and mouse.
export class HandDrag {
  private gesture: Gesture | null = null;
  private suppressClick = false;
  private suppressedPointers = new Set<number>();

  constructor(private options: Options) {
    options.hand.addEventListener('pointerdown', this.down);
    options.hand.addEventListener('touchmove', this.touchMove, { passive: false });
    options.hand.addEventListener('click', this.click, true);
    options.hand.addEventListener('lostpointercapture', this.lostCapture);
    window.addEventListener('pointermove', this.move, { passive: false });
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.cancelPointer);
    window.addEventListener('blur', this.blur);
  }

  get dragging() { return !!this.gesture?.preview; }

  private touchMove = (event: TouchEvent) => {
    // Hand movement is managed here, not by the browser's scroll recognizer.
    // Canceling the native touch move also keeps the next UI tap responsive.
    if (this.gesture) event.preventDefault();
  };

  private down = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0 || this.gesture || this.options.game.paused) return;
    const node = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.hand-card') : null;
    if (!node || node.disabled || node.closest('[inert]')) return;
    const card = this.options.game.human.hand.find(c => this.options.node(c) === node);
    if (!card) return;
    this.suppressClick = false;
    this.suppressedPointers.delete(event.pointerId);
    const rect = node.getBoundingClientRect();
    this.gesture = {
      card, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top,
      width: rect.width, height: rect.height,
      originalIndex: this.options.game.human.hand.indexOf(card), originalPage: this.options.page(),
      preview: null, pageStep: 0,
    };
  };

  private move = (event: PointerEvent) => {
    const g = this.gesture;
    if (!g || event.pointerId !== g.pointerId) return;
    if (!g.preview) {
      if (Math.hypot(event.clientX - g.startX, event.clientY - g.startY) < 8) return;
      g.preview = document.createElement('div');
      g.preview.className = `drag-preview${this.options.hand.closest('.desktop') ? '' : ' mobile-drag'}`;
      g.preview.setAttribute('aria-hidden', 'true');
      g.preview.style.width = `${g.width}px`;
      g.preview.style.height = `${g.height}px`;
      g.preview.append(this.options.face(g.card));
      document.body.append(g.preview);
      this.options.node(g.card)?.classList.add('drag-source');
      this.options.hand.classList.add('dragging');
      // Capture on the stable hand container, since card nodes move during sorting.
      this.options.hand.setPointerCapture(g.pointerId);
    }
    event.preventDefault();
    g.preview.style.left = `${event.clientX - g.offsetX}px`;
    g.preview.style.top = `${event.clientY - g.offsetY}px`;
    this.reorderAt(event.clientX, event.clientY);
    g.preview.classList.toggle('last-hand-card',this.options.game.human.hand.at(-1) === g.card);
    this.pageHover(event.clientX, event.clientY);
  };

  private insideHand(x: number, y: number) {
    const rect = this.options.hand.parentElement!.getBoundingClientRect();
    return x >= rect.left - 8 && x <= rect.right + 8 && y >= rect.top - 36 && y <= rect.bottom + 12;
  }

  private reorderAt(x: number, y: number) {
    const g = this.gesture;
    if (!g?.preview || !this.insideHand(x, y)) return;
    // Use the dragged card's center, so grabbing an exposed corner works naturally.
    const centerX = x - g.offsetX + g.width / 2;
    const centerY = y - g.offsetY + g.height / 2;
    let target = -1;
    let distance = Infinity;
    this.options.game.human.hand.forEach((card, index) => {
      const node = this.options.node(card);
      if (!node || node.hidden) return;
      const rect = node.getBoundingClientRect();
      const d = (rect.left + rect.width / 2 - centerX) ** 2 + (rect.top + rect.height / 2 - centerY) ** 2;
      if (d < distance) { target = index; distance = d; }
    });
    if (target >= 0) this.options.game.moveHandCard(g.card, target);
  }

  private pageHover(x: number, y: number) {
    const g = this.gesture;
    if (!g) return;
    let step: -1 | 0 | 1 = 0;
    for (const direction of [-1, 1] as const) {
      const button = this.options.pageButton(direction);
      if (button.disabled || button.parentElement!.hidden) continue;
      const rect = button.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) step = direction;
    }
    if (step === g.pageStep) return;
    clearTimeout(g.pageTimer);
    g.pageStep = step;
    if (step) g.pageTimer = window.setTimeout(() => {
      if (this.gesture !== g) return;
      this.options.setPage(this.options.page() + step);
      g.pageTimer = undefined;
    }, 500);
  }

  private up = (event: PointerEvent) => {
    const g = this.gesture;
    if (!g || event.pointerId !== g.pointerId) return;
    if (!g.preview) {
      this.gesture = null;
      // Handle touch/pen taps directly. Browsers can suppress compatibility
      // clicks after a captured touch drag, so don't rely on those for selection.
      if (event.pointerType !== 'mouse') {
        event.preventDefault();
        this.suppressPointerClick(g.pointerId);
        this.options.game.selectHand(g.card);
      }
      return;
    }
    event.preventDefault();
    if (!this.insideHand(event.clientX, event.clientY)) { this.cancel(); return; }
    this.reorderAt(event.clientX, event.clientY);
    g.preview.classList.toggle('last-hand-card',this.options.game.human.hand.at(-1) === g.card);
    this.finish();
  };

  private click = (event: MouseEvent) => {
    // Ignore compatibility clicks already handled by a gesture. Keyboard activation still works.
    const pointerId = event instanceof PointerEvent ? event.pointerId : undefined;
    if (event.detail !== 0 && (this.suppressClick || pointerId !== undefined && this.suppressedPointers.has(pointerId))) {
      event.preventDefault(); event.stopImmediatePropagation(); this.suppressClick = false;
      if (pointerId !== undefined) this.suppressedPointers.delete(pointerId);
    }
  };

  private suppressPointerClick(pointerId: number) {
    this.suppressClick = true;
    this.suppressedPointers.add(pointerId);
    if (this.suppressedPointers.size > 32) this.suppressedPointers.delete(this.suppressedPointers.values().next().value!);
  }

  private cancelPointer = (event: PointerEvent) => {
    if (this.gesture?.pointerId === event.pointerId) this.cancel();
  };
  private lostCapture = (event: PointerEvent) => {
    // Touch starts with implicit capture on the card. Its release bubbles here
    // when we transfer capture to the hand; that is not a canceled gesture.
    if (event.target === this.options.hand && !this.options.hand.hasPointerCapture(event.pointerId)) this.cancelPointer(event);
  };
  private blur = () => this.cancel();

  private finish() {
    const g = this.gesture;
    if (!g) return;
    this.gesture = null;
    clearTimeout(g.pageTimer);
    if (g.preview) this.suppressPointerClick(g.pointerId);
    g.preview?.remove();
    this.options.node(g.card)?.classList.remove('drag-source');
    this.options.hand.classList.remove('dragging');
    if (this.options.hand.hasPointerCapture(g.pointerId)) this.options.hand.releasePointerCapture(g.pointerId);
  }

  cancel(restore = true) {
    const g = this.gesture;
    if (!g) return;
    this.finish();
    if (restore && g.preview && this.options.game.human.hand.includes(g.card) && !this.options.game.paused) {
      this.options.game.moveHandCard(g.card, Math.min(g.originalIndex, this.options.game.human.hand.length - 1));
      this.options.setPage(g.originalPage);
    }
  }

  validate() {
    if (this.gesture && (this.options.game.paused || !this.options.game.human.hand.includes(this.gesture.card))) this.cancel(false);
  }

  dispose() {
    this.cancel(false);
    this.options.hand.removeEventListener('pointerdown', this.down);
    this.options.hand.removeEventListener('touchmove', this.touchMove);
    this.options.hand.removeEventListener('click', this.click, true);
    this.options.hand.removeEventListener('lostpointercapture', this.lostCapture);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.cancelPointer);
    window.removeEventListener('blur', this.blur);
  }
}
