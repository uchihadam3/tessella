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
  private stickStart = { x: 0, y: 0, t: 0 };
  private lookId: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private tapStart = { x: 0, y: 0, t: 0 };
  /** how far the mouse travelled while the button was held (CSS px): a long drag is a look, not a click */
  pressTravel = 0;
  private pressX = 0;
  private pressY = 0;
  /** called for a short tap (touch) so the game can treat it as a click at that point */
  onTap: (x: number, y: number) => void = () => {};

  // ── touch "pointer mode": while a panel is engaged every touch paints on the panel ──
  private pointerMode = false;
  private ptrId: number | null = null;
  private ptrStart = { x: 0, y: 0, t: 0 };
  onPointerDown: (x: number, y: number) => void = () => {};
  onPointerMove: (x: number, y: number) => void = () => {};
  onPointerUp: (x: number, y: number, tap: boolean) => void = () => {};
  /** thumb-stick feedback for the HUD (CSS px): null while the left thumb is up */
  stick: { ox: number; oy: number; x: number; y: number } | null = null;
  /** radius (CSS px) of a full stick deflection */
  readonly stickRadius = 58;

  constructor(private el: HTMLElement) {
    // touch: left side = walk (an invisible stick wherever the thumb lands), right side = look,
    // short taps = use what is under the finger. While a panel is engaged, touches paint tiles.
    el.addEventListener('touchstart', (e) => {
      this.setTouch();
      // the time the finger landed (not when a busy frame got around to handling it)
      const now = e.timeStamp || performance.now();
      for (const t of Array.from(e.changedTouches)) {
        if (this.pointerMode) {
          if (this.ptrId === null) {
            this.ptrId = t.identifier;
            this.ptrStart = { x: t.clientX, y: t.clientY, t: now };
            this.onPointerDown(t.clientX, t.clientY);
          }
          continue;
        }
        if (t.clientX < window.innerWidth * 0.42 && this.stickId === null) {
          this.stickId = t.identifier;
          this.stickOrigin = { x: t.clientX, y: t.clientY };
          this.stickStart = { x: t.clientX, y: t.clientY, t: now };
          this.stick = { ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY };
        } else if (this.lookId === null) {
          this.lookId = t.identifier;
          this.lookLast = { x: t.clientX, y: t.clientY };
          this.tapStart = { x: t.clientX, y: t.clientY, t: now };
        }
      }
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.ptrId) {
          this.onPointerMove(t.clientX, t.clientY);
        } else if (t.identifier === this.stickId) {
          const R = this.stickRadius;
          let dx = t.clientX - this.stickOrigin.x, dy = t.clientY - this.stickOrigin.y;
          const l = Math.hypot(dx, dy);
          // the stick follows the thumb when it slides past the rim, so walking never "sticks"
          if (l > R * 1.35) {
            this.stickOrigin.x += (dx / l) * (l - R * 1.35);
            this.stickOrigin.y += (dy / l) * (l - R * 1.35);
            dx = t.clientX - this.stickOrigin.x;
            dy = t.clientY - this.stickOrigin.y;
          }
          const m = Math.min(1, Math.hypot(dx, dy) / R);
          const a = Math.atan2(dy, dx);
          // small dead zone so a resting thumb does not drift
          const mm = m < 0.12 ? 0 : (m - 0.12) / 0.88;
          this.touchMove = { x: Math.cos(a) * mm, y: -Math.sin(a) * mm };
          this.stick = { ox: this.stickOrigin.x, oy: this.stickOrigin.y, x: t.clientX, y: t.clientY };
        } else if (t.identifier === this.lookId) {
          this.dx += (t.clientX - this.lookLast.x) * 1.6;
          this.dy += (t.clientY - this.lookLast.y) * 1.6;
          this.lookLast = { x: t.clientX, y: t.clientY };
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e: TouchEvent) => {
      const now = e.timeStamp || performance.now();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.ptrId) {
          this.ptrId = null;
          const moved = Math.hypot(t.clientX - this.ptrStart.x, t.clientY - this.ptrStart.y);
          this.onPointerUp(t.clientX, t.clientY, moved < 14 && now - this.ptrStart.t < 450);
        } else if (t.identifier === this.stickId) {
          this.stickId = null;
          this.stick = null;
          this.touchMove = { x: 0, y: 0 };
          // a quick tap on the left side is still a tap (a panel can be on that side of the screen)
          const moved = Math.hypot(t.clientX - this.stickStart.x, t.clientY - this.stickStart.y);
          if (moved < 12 && now - this.stickStart.t < 320) this.onTap(t.clientX, t.clientY);
        } else if (t.identifier === this.lookId) {
          this.lookId = null;
          const moved = Math.hypot(t.clientX - this.tapStart.x, t.clientY - this.tapStart.y);
          if (moved < 12 && now - this.tapStart.t < 350) this.onTap(t.clientX, t.clientY);
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

  /** while a panel is engaged, touches paint on it instead of walking/looking */
  setPointerMode(on: boolean) {
    if (on === this.pointerMode) return;
    this.pointerMode = on;
    this.stickId = this.lookId = this.ptrId = null;
    this.stick = null;
    this.touchMove = { x: 0, y: 0 };
  }

  /** called on the first touch: the UI switches to its touch layout */
  onTouchMode: () => void = () => {};
  private setTouch() {
    if (this.isTouch) return;
    this.isTouch = true;
    this.onTouchMode();
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
    // touch: pushing the stick all the way runs
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || (this.stickId !== null && Math.hypot(this.touchMove.x, this.touchMove.y) > 0.93);
  }
}
