/** Keyboard + mouse (pointer lock) + touch input. */

export class Input {
  readonly keys = new Set<string>();
  /** accumulated mouse movement since last consume (pointer-locked) */
  dx = 0;
  dy = 0;
  /** mouse position in CSS pixels */
  mx = 0;
  my = 0;
  locked = false;
  /** virtual joystick (touch) */
  touchMove = { x: 0, y: 0 };
  isTouch = false;
  private pressed = new Set<string>();
  private listeners: { [k: string]: ((e: Event) => void)[] } = {};

  /** drag-to-look fallback (when pointer lock is unavailable, e.g. inside some iframes) */
  dragLook = false;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private lookId: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private tapStart = { x: 0, y: 0, t: 0 };
  /** how far the mouse travelled while the button was held (CSS px): a long drag is a look, not a click */
  pressTravel = 0;
  private pressX = 0;
  private pressY = 0;
  /** called for a short tap (touch) so the game can treat it as a click at that point */
  onTap: (x: number, y: number) => void = () => {};

  constructor(private el: HTMLElement) {
    // touch: left half = joystick, right half = look; short taps = clicks
    el.addEventListener('touchstart', (e) => {
      this.isTouch = true;
      for (const t of Array.from(e.changedTouches)) {
        if (t.clientX < window.innerWidth * 0.45 && this.stickId === null) {
          this.stickId = t.identifier;
          this.stickOrigin = { x: t.clientX, y: t.clientY };
        } else if (this.lookId === null) {
          this.lookId = t.identifier;
          this.lookLast = { x: t.clientX, y: t.clientY };
          this.tapStart = { x: t.clientX, y: t.clientY, t: performance.now() };
        }
      }
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.stickId) {
          const dx = (t.clientX - this.stickOrigin.x) / 60, dy = (t.clientY - this.stickOrigin.y) / 60;
          const l = Math.hypot(dx, dy);
          this.touchMove = l > 1 ? { x: dx / l, y: -dy / l } : { x: dx, y: -dy };
        } else if (t.identifier === this.lookId) {
          this.dx += (t.clientX - this.lookLast.x) * 1.6;
          this.dy += (t.clientY - this.lookLast.y) * 1.6;
          this.lookLast = { x: t.clientX, y: t.clientY };
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.stickId) {
          this.stickId = null;
          this.touchMove = { x: 0, y: 0 };
        } else if (t.identifier === this.lookId) {
          this.lookId = null;
          const moved = Math.hypot(t.clientX - this.tapStart.x, t.clientY - this.tapStart.y);
          if (moved < 12 && performance.now() - this.tapStart.t < 350) this.onTap(t.clientX, t.clientY);
        }
      }
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    // mouse drag-to-look fallback
    el.addEventListener('mousedown', (e) => {
      this.pressX = e.clientX;
      this.pressY = e.clientY;
      this.pressTravel = 0;
      if (this.dragLook && !this.locked && e.button === 0) {
        this.dragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    });
    window.addEventListener('mouseup', () => (this.dragging = false));
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      this.emit('keydown', e);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.emit('keyup', e);
    });
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      this.mx = e.clientX;
      this.my = e.clientY;
      if (e.buttons & 1) this.pressTravel = Math.max(this.pressTravel, Math.hypot(e.clientX - this.pressX, e.clientY - this.pressY));
      if (this.dragging && !this.locked) {
        this.dx += e.clientX - this.lastX;
        this.dy += e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
      if (this.locked) {
        // ignore absurd spikes some browsers produce right after locking
        if (Math.abs(e.movementX) < 400 && Math.abs(e.movementY) < 400) {
          this.dx += e.movementX;
          this.dy += e.movementY;
        }
      }
      this.emit('mousemove', e);
    });
    el.addEventListener('mousedown', (e) => this.emit('mousedown', e));
    window.addEventListener('mouseup', (e) => this.emit('mouseup', e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => this.emit('wheel', e), { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
      this.emit('lockchange', new Event('lockchange'));
    });
    document.addEventListener('pointerlockerror', () => {
      // pointer lock refused (sandboxed iframe, some browsers): look by dragging instead
      this.dragLook = true;
      this.emit('lockerror', new Event('lockerror'));
    });
  }

  on(type: string, fn: (e: Event) => void) {
    (this.listeners[type] ||= []).push(fn);
  }
  private emit(type: string, e: Event) {
    for (const fn of this.listeners[type] ?? []) fn(e);
  }

  /** true once per key press */
  wasPressed(code: string): boolean {
    const p = this.pressed.has(code);
    return p;
  }
  endFrame() {
    this.pressed.clear();
  }

  consumeMouse(): [number, number] {
    const r: [number, number] = [this.dx, this.dy];
    this.dx = 0;
    this.dy = 0;
    return r;
  }

  lock() {
    if (this.locked || this.isTouch) return;
    if (!this.el.requestPointerLock) {
      this.dragLook = true;
      return;
    }
    try {
      const p = this.el.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => (this.dragLook = true));
    } catch {
      this.dragLook = true;
    }
  }

  /** true when the camera should follow mouse/touch deltas */
  get looking(): boolean {
    return this.locked || this.dragging || this.lookId !== null;
  }
  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  axis(): { x: number; y: number } {
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    x += this.touchMove.x;
    y += this.touchMove.y;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }

  get running(): boolean {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }
}
