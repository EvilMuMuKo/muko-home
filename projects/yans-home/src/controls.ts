export interface StickState {
  pointer: number | null;
  origin: [number, number];
  vector: [number, number];
  visible: boolean;
}
export class FloatingSticks {
  readonly move: StickState = {
    pointer: null,
    origin: [0, 0],
    vector: [0, 0],
    visible: false,
  };
  readonly look: StickState = {
    pointer: null,
    origin: [0, 0],
    vector: [0, 0],
    visible: false,
  };
  private elements: Record<string, HTMLElement>;
  constructor(
    private canvas: HTMLCanvasElement,
    private enabled: () => boolean,
    private request: () => void,
  ) {
    this.elements = {
      move: document.querySelector("#stick-move")!,
      look: document.querySelector("#stick-look")!,
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (!enabled() || e.button > 0) return;
      const rect = canvas.getBoundingClientRect();
      const side =
        e.pointerType === "mouse"
          ? "look"
          : e.clientX - rect.left < rect.width / 2
            ? "move"
            : "look";
      const s = this[side];
      if (s.pointer !== null) return;
      e.preventDefault();
      s.pointer = e.pointerId;
      s.origin = [e.clientX, e.clientY];
      s.vector = [0, 0];
      s.visible = true;
      const el = this.elements[side];
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
      el.classList.add("active");
      canvas.setPointerCapture(e.pointerId);
      this.paint(side);
      request();
    });
    canvas.addEventListener("pointermove", (e) => {
      for (const side of ["move", "look"] as const) {
        const s = this[side];
        if (s.pointer !== e.pointerId) continue;
        const dx = (e.clientX - s.origin[0]) / 46,
          dy = (e.clientY - s.origin[1]) / 46,
          len = Math.max(1, Math.hypot(dx, dy));
        s.vector = [dx / len, dy / len];
        this.paint(side);
        request();
      }
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      canvas.addEventListener(event, (e) => {
        for (const side of ["move", "look"] as const)
          if (this[side].pointer === (e as PointerEvent).pointerId)
            this.release(side);
      });
    window.addEventListener("blur", () => this.clear());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.clear();
    });
  }
  private paint(side: "move" | "look") {
    const s = this[side];
    this.elements[side].querySelector<HTMLElement>("span")!.style.transform =
      `translate(${s.vector[0] * 34}px,${s.vector[1] * 34}px)`;
  }
  private release(side: "move" | "look") {
    Object.assign(this[side], {
      pointer: null,
      vector: [0, 0],
      visible: false,
    });
    this.elements[side].classList.remove("active");
    this.paint(side);
    this.request();
  }
  clear() {
    this.release("move");
    this.release("look");
  }
  getState() {
    return {
      move: structuredClone(this.move),
      look: structuredClone(this.look),
    };
  }
}
