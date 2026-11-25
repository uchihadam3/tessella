/**
 * Render worker: synthesises instrument zones and impulse responses off the main thread.
 * Bundled inline (Vite `?worker&inline`) so it also works in the single-file offline build.
 */
import { type BufInst, makeImpulseData, renderZone, type ReverbKind } from './dsp';

type Req = { id: number; kind: 'zone'; inst: BufInst; zone: number } | { id: number; kind: 'ir'; mode: ReverbKind; sr: number };

const post = (msg: unknown, transfer: Transferable[]) => (self as unknown as Worker).postMessage(msg, transfer);

self.onmessage = (e: MessageEvent<Req>) => {
  const r = e.data;
  try {
    if (r.kind === 'zone') {
      const out = renderZone(r.inst, r.zone);
      post({ id: r.id, ok: true, data: out.data, sr: out.sr }, [out.data.buffer]);
    } else {
      const [L, R] = makeImpulseData(r.mode, r.sr);
      post({ id: r.id, ok: true, L, R }, [L.buffer, R.buffer]);
    }
  } catch (err) {
    post({ id: r.id, ok: false, error: String(err) }, []);
  }
};
