/**
 * Solver for the desert's path panels: the wells of each colour joined by a path of lit tiles,
 * one wide, never branching, never touching itself or another path; waymarks lie on a path,
 * locked tiles keep their state. Every such answer is enumerated by walking the paths one colour
 * at a time (with a reachability cut), so uniqueness is exact.
 */
import type { PuzzleDef } from './types';
import { geometryOf } from './rules';

export function isPathPuzzle(p: PuzzleDef): boolean {
  return p.cells.some((c) => c.glyph?.kind === 'well');
}

export interface PathSolveResult {
  solutions: Uint8Array[];
  complete: boolean;
  nodes: number;
}

export function solvePaths(p: PuzzleDef, maxSolutions = 2, maxNodes = 2_000_000, deadlineMs = 20_000): PathSolveResult {
  const g = geometryOf(p);
  const n = p.w * p.h;
  const deadline = Date.now() + deadlineMs;
  const nb = g.dir4.map((d) => d.filter((j) => j >= 0 && !p.cells[j].hole));
  const byColor = new Map<string, number[]>();
  const must: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = p.cells[i];
    if (c.hole) continue;
    if (c.glyph?.kind === 'well') {
      const k = c.glyph.color;
      if (!byColor.has(k)) byColor.set(k, []);
      byColor.get(k)!.push(i);
    }
    if (c.glyph?.kind === 'dot' || c.lock === 1 || p.target?.[i] === '1') must.push(i);
  }
  const pairs = [...byColor.values()];
  const solutions: Uint8Array[] = [];
  if (pairs.some((q) => q.length !== 2)) return { solutions, complete: true, nodes: 0 };
  const lit = new Uint8Array(n);
  for (const q of pairs) for (const t of q) lit[t] = 1;
  const isWell = new Uint8Array(n);
  for (const q of pairs) for (const t of q) isWell[t] = 1;
  // (a drawing seen in the place fixes some tiles too: '0' dark, '1' lit, '?' free)
  const dark = (t: number) => p.cells[t].lock === 0 || p.target?.[t] === '0';
  let nodes = 0;
  let aborted = false;

  // can `t` be added to the path whose head is `head` (not touching anything else lit)?
  const free = (t: number, head: number, goal: number) => {
    if (lit[t] || dark(t) || isWell[t]) return false;
    for (const j of nb[t]) if (j !== head && j !== goal && lit[j]) return false;
    return true;
  };
  // is `goal` still reachable from `head` through tiles that could join the path?
  const reach = (head: number, goal: number) => {
    const seen = new Uint8Array(n);
    const st = [head];
    seen[head] = 1;
    while (st.length) {
      const t = st.pop()!;
      for (const j of nb[t]) {
        if (j === goal) return true;
        if (seen[j] || lit[j] || dark(j) || isWell[j]) continue;
        let ok = true;
        for (const k of nb[j]) if (k !== t && k !== goal && lit[k] && k !== head) { ok = false; break; }
        if (!ok) continue;
        seen[j] = 1;
        st.push(j);
      }
    }
    return false;
  };
  const finish = () => {
    for (const t of must) if (!lit[t]) return;
    // the wells must end their paths: exactly one lit neighbour each
    for (const q of pairs) for (const t of q) { let d = 0; for (const j of nb[t]) if (lit[j]) d++; if (d !== 1) return; }
    solutions.push(Uint8Array.from(lit));
  };

  const route = (pi: number) => {
    if (aborted || solutions.length >= maxSolutions) return;
    if (pi === pairs.length) { finish(); return; }
    const [a, b] = pairs[pi];
    // the start well must not already touch a lit tile
    for (const j of nb[a]) if (lit[j] && j !== b) return;
    if (nb[a].includes(b)) {
      // two wells side by side: the path is just them (if nothing else may touch)
      route(pi + 1);
      return;
    }
    const walk = (head: number, prev: number) => {
      if (aborted || solutions.length >= maxSolutions) return;
      nodes++;
      if (nodes > maxNodes || (nodes % 1024 === 0 && Date.now() > deadline)) { aborted = true; return; }
      for (const t of nb[head]) {
        if (t === prev) continue;
        if (t === b) {
          if (head === a) continue;
          route(pi + 1);
          continue;
        }
        if (!free(t, head, b)) continue;
        // touching the goal means the next step must be the goal; touching the start well is not allowed
        if (nb[t].includes(a) && head !== a) continue;
        lit[t] = 1;
        if (nb[t].includes(b)) route(pi + 1);
        else if (reach(t, b)) walk(t, head);
        lit[t] = 0;
        if (aborted || solutions.length >= maxSolutions) return;
      }
    };
    walk(a, -1);
  };
  route(0);
  return { solutions, complete: !aborted, nodes };
}
