/**
 * Asynchronous synthesis jobs with priorities. Uses an inline Web Worker when available;
 * otherwise falls back to small main-thread slices (pump) so nothing ever blocks for long.
 */
import RenderWorker from './render.worker?worker&inline';
import { type BufInst, makeImpulseData, type Rendered, renderZone, type ReverbKind } from './dsp';
import { report } from './util';

type Msg = { kind: 'zone'; inst: BufInst; zone: number } | { kind: 'ir'; mode: ReverbKind; sr: number };

interface Job {
  id: number;
  key: string;
  prio: number;
  seq: number;
  msg: Msg;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
}

interface Reply {
  id: number;
  ok: boolean;
  data?: Float32Array;
  sr?: number;
  L?: Float32Array;
  R?: Float32Array;
  error?: string;
}

export class Renderer {
  private worker: Worker | null = null;
  private queue: Job[] = [];
  private readonly inflight = new Map<number, Job>();
  private nextId = 1;
  private seq = 0;
  private readonly maxInflight = 2;

  constructor(useWorker = true) {
    if (!useWorker || typeof Worker === 'undefined') return;
    try {
      const w = new RenderWorker();
      w.onmessage = (e: MessageEvent<Reply>) => this.onReply(e.data);
      w.onerror = (e) => {
        e.preventDefault?.();
        this.fallback('worker error');
      };
      this.worker = w;
    } catch (e) {
      report('render worker unavailable, using main-thread slices', e);
      this.worker = null;
    }
  }

  get usesWorker(): boolean {
    return !!this.worker;
  }

  zone(inst: BufInst, zone: number, prio: number): Promise<Rendered> {
    return this.enqueue(`z:${inst}:${zone}`, prio, { kind: 'zone', inst, zone }) as Promise<Rendered>;
  }

  impulse(mode: ReverbKind, sr: number, prio: number): Promise<[Float32Array, Float32Array]> {
    return this.enqueue(`ir:${mode}:${sr}`, prio, { kind: 'ir', mode, sr }) as Promise<[Float32Array, Float32Array]>;
  }

  /** Raise the priority of a queued job (e.g. a note needs it right now). */
  bump(key: string, prio: number): void {
    const j = this.queue.find((x) => x.key === key);
    if (j && prio < j.prio) j.prio = prio;
  }

  private enqueue(key: string, prio: number, msg: Msg): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, key, prio, seq: this.seq++, msg, resolve, reject });
      this.dispatch();
    });
  }

  private take(): Job | undefined {
    if (!this.queue.length) return undefined;
    let best = 0;
    for (let i = 1; i < this.queue.length; i++) {
      const a = this.queue[i];
      const b = this.queue[best];
      if (a.prio < b.prio || (a.prio === b.prio && a.seq < b.seq)) best = i;
    }
    return this.queue.splice(best, 1)[0];
  }

  private dispatch(): void {
    const w = this.worker;
    if (!w) return;
    while (this.inflight.size < this.maxInflight && this.queue.length) {
      const job = this.take()!;
      this.inflight.set(job.id, job);
      try {
        w.postMessage({ id: job.id, ...job.msg });
      } catch (e) {
        this.inflight.delete(job.id);
        this.queue.push(job);
        this.fallback(String(e));
        return;
      }
    }
  }

  private onReply(m: Reply): void {
    const job = this.inflight.get(m.id);
    if (!job) return;
    this.inflight.delete(m.id);
    if (!m.ok) job.reject(new Error(m.error));
    else if (job.msg.kind === 'zone') job.resolve({ data: m.data!, sr: m.sr! });
    else job.resolve([m.L!, m.R!]);
    this.dispatch();
  }

  private fallback(why: string): void {
    report('render worker failed, falling back', why);
    try {
      this.worker?.terminate();
    } catch {
      /* ignore */
    }
    this.worker = null;
    for (const j of this.inflight.values()) this.queue.push(j);
    this.inflight.clear();
  }

  /** Main-thread fallback: run queued jobs within a time budget (no-op when a worker is active). */
  pump(budgetMs: number): void {
    if (this.worker) return;
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < budgetMs) {
      const job = this.take()!;
      try {
        if (job.msg.kind === 'zone') job.resolve(renderZone(job.msg.inst, job.msg.zone));
        else job.resolve(makeImpulseData(job.msg.mode, job.msg.sr));
      } catch (e) {
        job.reject(e);
      }
    }
  }

  dispose(): void {
    try {
      this.worker?.terminate();
    } catch {
      /* ignore */
    }
    this.worker = null;
  }
}
