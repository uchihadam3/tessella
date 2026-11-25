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

  constructor(private el: HTMLElement) {
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
    document.addEventListener('pointerlockerror', () => this.emit('lockerror', new Event('lockerror')));
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
    if (this.locked) return;
    try {
      const p = this.el.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      /* ignore */
    }
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
