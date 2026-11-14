const HOLD_MS = 450;
const MOVE_TOLERANCE = 10;
const CARD = "details.workout-exercise";

// Touch scrolling stays native until the hold completes. Preventing touchmove
// only after activation lets iPhone users both scroll and reorder the same list.
export class BrowserExerciseDrag {
  constructor(root, move) {
    this.root = root;
    this.move = move;
    this.page = root.ownerDocument.defaultView;
    this.gesture = null;
    this.suppressClick = false;
    root.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) return this.cancel();
        this.begin(event.target, event.touches[0], "touch");
      },
      { passive: true },
    );
    root.addEventListener(
      "touchmove",
      (event) => {
        if (event.touches.length !== 1) return this.cancel();
        if (this.update(event.touches[0])) event.preventDefault();
      },
      { passive: false },
    );
    root.addEventListener("touchend", (event) => {
      if (!event.touches.length) this.finish("touch");
    });
    root.addEventListener("touchcancel", () => this.cancel());
    root.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch" || event.button !== 0) return;
      this.begin(event.target, event, "pointer");
    });
    this.page.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "touch" && this.update(event))
        event.preventDefault();
    });
    this.page.addEventListener("pointerup", (event) => {
      if (event.pointerType !== "touch") this.finish("pointer");
    });
    this.page.addEventListener("pointercancel", (event) => {
      if (event.pointerType !== "touch") this.cancel();
    });
    this.page.addEventListener("blur", () => this.cancel());
    root.ownerDocument.addEventListener("visibilitychange", () => {
      if (root.ownerDocument.hidden) this.cancel();
    });
    root.addEventListener("contextmenu", (event) => {
      if (this.gesture) event.preventDefault();
    });
    root.addEventListener(
      "click",
      (event) => {
        if (!this.suppressClick) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        this.suppressClick = false;
      },
      true,
    );
    this.page.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.cancel();
    });
    root.addEventListener("keydown", (event) => {
      if (!this.gesture) this.suppressClick = false;
      if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key))
        return;
      const card = event.target.closest(CARD);
      if (!card || !event.target.closest("summary")) return;
      event.preventDefault();
      const index = this.cards().indexOf(card);
      const destination = index + (event.key === "ArrowUp" ? -1 : 1);
      if (destination >= 0 && destination < this.cards().length)
        this.move(card.dataset.exerciseId, destination, true);
    });
  }
  cards() {
    return [...this.root.querySelectorAll(CARD)];
  }
  begin(target, point, input) {
    this.cancel();
    this.suppressClick = false;
    if (target.closest("button, input, textarea, select, a, [contenteditable]"))
      return;
    const card = target.closest(CARD);
    if (!card || this.cards().length < 2) return;
    const gesture = (this.gesture = {
      card,
      input,
      x: point.clientX,
      y: point.clientY,
      order: this.cards(),
      active: false,
    });
    gesture.timer = this.page.setTimeout(() => this.activate(gesture), HOLD_MS);
  }
  activate(gesture) {
    if (this.gesture !== gesture || !gesture.card.isConnected)
      return this.cancel();
    gesture.active = true;
    this.suppressClick = true;
    const rect = gesture.card.getBoundingClientRect();
    gesture.offset = Math.min(gesture.y - rect.top, 80);
    gesture.preview = gesture.card.cloneNode(true);
    gesture.preview.removeAttribute("id");
    gesture.preview
      .querySelectorAll("[id]")
      .forEach((element) => element.removeAttribute("id"));
    gesture.preview.classList.add("exercise-drag-preview");
    gesture.preview.setAttribute("aria-hidden", "true");
    gesture.preview.inert = true;
    gesture.preview.style.width = `${rect.width}px`;
    gesture.preview.style.left = `${rect.left}px`;
    gesture.card.classList.add("exercise-dragging");
    this.root.ownerDocument.body.append(gesture.preview);
    this.position();
    const frame = () => {
      if (this.gesture !== gesture) return;
      if (!gesture.card.isConnected) return this.cancel();
      const edge = 70;
      const speed =
        gesture.y < edge
          ? -Math.min(14, (edge - gesture.y) / 4)
          : gesture.y > this.page.innerHeight - edge
            ? Math.min(14, (gesture.y - this.page.innerHeight + edge) / 4)
            : 0;
      if (speed) {
        this.page.scrollBy(0, speed);
        this.position();
      }
      gesture.frame = this.page.requestAnimationFrame(frame);
    };
    gesture.frame = this.page.requestAnimationFrame(frame);
  }
  update(point) {
    const gesture = this.gesture;
    if (!gesture) return false;
    if (!gesture.active) {
      if (
        Math.hypot(point.clientX - gesture.x, point.clientY - gesture.y) >
        MOVE_TOLERANCE
      )
        this.cancel();
      return false;
    }
    gesture.y = point.clientY;
    this.position();
    return true;
  }
  position() {
    const gesture = this.gesture;
    gesture.preview.style.top = `${gesture.y - gesture.offset}px`;
    const others = this.cards().filter((card) => card !== gesture.card);
    const next = others.find((card) => {
      const rect = card.getBoundingClientRect();
      return gesture.y < rect.top + rect.height / 2;
    });
    if (next) next.before(gesture.card);
    else others.at(-1)?.after(gesture.card);
  }
  finish(input) {
    const gesture = this.gesture;
    if (!gesture || gesture.input !== input) return;
    const index = this.cards().indexOf(gesture.card);
    const active = gesture.active;
    const id = gesture.card.dataset.exerciseId;
    this.cleanup();
    if (active) this.move(id, index, false);
  }
  cleanup() {
    const gesture = this.gesture;
    if (!gesture) return;
    this.page.clearTimeout(gesture.timer);
    this.page.cancelAnimationFrame(gesture.frame);
    gesture.preview?.remove();
    gesture.card.classList.remove("exercise-dragging");
    this.gesture = null;
  }
  cancel() {
    const gesture = this.gesture;
    if (!gesture) return;
    if (gesture.active && gesture.card.isConnected) {
      const parent = gesture.card.parentElement;
      const after = this.cards().at(-1).nextSibling;
      for (const card of gesture.order) parent.insertBefore(card, after);
    }
    this.cleanup();
  }
}
