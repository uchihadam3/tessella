/**
 * Constellation solver: DFS with constraint pruning, GF(2) reachability for echo
 * constellations, press-sequence solving, and a "human" difficulty estimate based on
 * local deductions + contradiction lookahead.
 */
import type { ConstellationDef } from './types';
import { checkConstellation, initialState, neighbors, pressSet, wantsAllLit } from './graph';

// ───────────────────────── GF(2) helpers (bitmasks, n ≤ 30) ─────────────────────────

/** Free (non-locked) stars, in index order. */
function freeStars(def: ConstellationDef): number[] {
  const out: number[] = [];
  def.stars.forEach((s, i) => {
    if (s.lock === undefined) out.push(i);
  });
  return out;
}

/** Column j of the press matrix as a bitmask over star indices. */
function pressColumns(def: ConstellationDef): number[] {
  return freeStars(def).map((i) => pressSet(def, i).reduce((m, j) => m | (1 << j), 0));
}

/** Basis of the space of parity checks h (bitmasks over star indices) such that every reachable
 *  state s satisfies popcount(h & s) even (initial free stars are dark). Empty for full rank. */
export function parityChecks(def: ConstellationDef): number[] {
  if (!def.echo) return [];
  const free = freeStars(def);
  const cols = pressColumns(def);
  // Row-reduce the matrix whose rows are the columns of A (i.e. A^T); its null space gives h.
  // We work with h as unknown vector over free stars: h·col_j = 0 for every j.
  const n = free.length;
  // build equations: each equation is col_j restricted to free stars, as a mask over positions 0..n-1
  const eqs = cols.map((c) => {
    let m = 0;
    free.forEach((s, k) => {
      if (c & (1 << s)) m |= 1 << k;
    });
    return m;
  });
  // Gaussian elimination to find null space of the matrix with rows `eqs`
  const rows = eqs.slice();
  const pivotCol: number[] = [];
  let r = 0;
  for (let c = 0; c < n && r < rows.length; c++) {
    let p = -1;
    for (let k = r; k < rows.length; k++)
      if (rows[k] & (1 << c)) {
        p = k;
        break;
      }
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    for (let k = 0; k < rows.length; k++) if (k !== r && rows[k] & (1 << c)) rows[k] ^= rows[r];
    pivotCol.push(c);
    r++;
  }
  const pivots = new Set(pivotCol);
  const basis: number[] = [];
  for (let f = 0; f < n; f++) {
    if (pivots.has(f)) continue;
    // free variable f = 1, others free = 0, solve pivots
    let h = 1 << f;
    for (let k = 0; k < pivotCol.length; k++) {
      const pc = pivotCol[k];
      if (rows[k] & (1 << f)) h |= 1 << pc;
    }
    // translate to star-index mask
    let m = 0;
    for (let k = 0; k < n; k++) if (h & (1 << k)) m |= 1 << free[k];
    basis.push(m);
  }
  return basis;
}

function popParity(x: number): number {
  x ^= x >>> 16;
  x ^= x >>> 8;
  x ^= x >>> 4;
  x ^= x >>> 2;
  x ^= x >>> 1;
  return x & 1;
}

/** Can the state be reached from the initial state by pressing stars? */
export function reachable(def: ConstellationDef, state: ArrayLike<number>): boolean {
  const init = initialState(def);
  for (let i = 0; i < def.stars.length; i++) if (def.stars[i].lock !== undefined && state[i] !== init[i]) return false;
  if (!def.echo) return true;
  let s = 0;
  for (let i = 0; i < state.length; i++) if (state[i]) s |= 1 << i;
  return parityChecks(def).every((h) => popParity(h & s) === 0);
}

/** A set of presses (star indices) that turns the initial state into `target`, or null.
 *  Among several solutions, returns one with the fewest presses (searching the null space when small). */
export function pressesFor(def: ConstellationDef, target: ArrayLike<number>): number[] | null {
  const init = initialState(def);
  const free = freeStars(def);
  for (let i = 0; i < def.stars.length; i++) if (def.stars[i].lock !== undefined && target[i] !== init[i]) return null;
  if (!def.echo) return free.filter((i) => target[i] !== init[i]);
  const n = free.length;
  const cols = pressColumns(def); // column j = press of free[j]
  // rows: one per free star k: sum_j A[k][j] x_j = d_k
  const rowsA: number[] = [];
  const rhs: number[] = [];
  free.forEach((s, k) => {
    let m = 0;
    cols.forEach((c, j) => {
      if (c & (1 << s)) m |= 1 << j;
    });
    rowsA.push(m);
    rhs.push(target[s] !== init[s] ? 1 : 0);
    void k;
  });
  const rows = rowsA.slice();
  const b = rhs.slice();
  const pivotOf: number[] = [];
  let r = 0;
  for (let c = 0; c < n && r < rows.length; c++) {
    let p = -1;
    for (let k = r; k < rows.length; k++)
      if (rows[k] & (1 << c)) {
        p = k;
        break;
      }
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    [b[r], b[p]] = [b[p], b[r]];
    for (let k = 0; k < rows.length; k++)
      if (k !== r && rows[k] & (1 << c)) {
        rows[k] ^= rows[r];
        b[k] ^= b[r];
      }
    pivotOf.push(c);
    r++;
  }
  for (let k = r; k < rows.length; k++) if (b[k]) return null; // inconsistent
  const pivotSet = new Set(pivotOf);
  const freeVars = [...Array(n).keys()].filter((c) => !pivotSet.has(c));
  const particular = (fv: number) => {
    let x = 0;
    freeVars.forEach((c, k) => {
      if (fv & (1 << k)) x |= 1 << c;
    });
    for (let k = 0; k < pivotOf.length; k++) {
      let v = b[k];
      for (const c of freeVars) if (rows[k] & (1 << c) && x & (1 << c)) v ^= 1;
      if (v) x |= 1 << pivotOf[k];
    }
    return x;
  };
  let best = particular(0);
  if (freeVars.length <= 12) {
    const pc = (x: number) => {
      let c = 0;
      while (x) {
        x &= x - 1;
        c++;
      }
      return c;
    };
    for (let fv = 1; fv < 1 << freeVars.length; fv++) {
      const x = particular(fv);
      if (pc(x) < pc(best)) best = x;
    }
  }
  const out: number[] = [];
  for (let j = 0; j < n; j++) if (best & (1 << j)) out.push(free[j]);
  return out;
}

// ───────────────────────── partial-state reasoning ─────────────────────────

/** Shared machinery for the DFS solver and the deduction engine. `known[i]` is -1, 0 or 1. */
class Reasoner {
  readonly n: number;
  readonly adj: number[][];
  readonly allLit: boolean;
  readonly parity: number[];
  readonly contour: [number, number][] = [];
  readonly mosaic: [number, number][] = [];
  readonly measure: [number, number][] = [];
  readonly gems: Map<string, number[]> = new Map();
  readonly gemColor: (string | null)[];
  readonly marks: [number, number, boolean][] = []; // a, b, same?

  constructor(readonly def: ConstellationDef) {
    this.n = def.stars.length;
    this.adj = neighbors(def);
    this.allLit = wantsAllLit(def);
    this.parity = parityChecks(def);
    this.gemColor = def.stars.map(() => null);
    def.stars.forEach((s, i) => {
      const g = s.glyph;
      if (!g) return;
      if (g.kind === 'contour') this.contour.push([i, g.n]);
      else if (g.kind === 'mosaic') this.mosaic.push([i, g.n]);
      else if (g.kind === 'measure') this.measure.push([i, g.n]);
      else if (g.kind === 'gem') {
        if (!this.gems.has(g.color)) this.gems.set(g.color, []);
        this.gems.get(g.color)!.push(i);
        this.gemColor[i] = g.color;
      }
    });
    for (const t of def.threads) if (t.mark) this.marks.push([t.a, t.b, t.mark === 'same']);
  }

  /** Known component of star t (same known state, connected through known stars). */
  comp(known: Int8Array, t: number): number[] {
    const s = known[t];
    const seen = new Set([t]);
    const list = [t];
    for (let k = 0; k < list.length; k++) {
      for (const j of this.adj[list[k]]) {
        if (!seen.has(j) && known[j] === s) {
          seen.add(j);
          list.push(j);
        }
      }
    }
    return list;
  }

  /** Stars reachable from the set through stars that are unknown or of state s. */
  potential(known: Int8Array, start: number[], s: number): Set<number> {
    const seen = new Set(start);
    const list = [...start];
    for (let k = 0; k < list.length; k++) {
      for (const j of this.adj[list[k]]) {
        if (!seen.has(j) && (known[j] === -1 || known[j] === s)) {
          seen.add(j);
          list.push(j);
        }
      }
    }
    return seen;
  }

  /** Quick consistency check of a partial state. */
  ok(known: Int8Array): boolean {
    const { adj } = this;
    if (this.allLit) {
      for (let i = 0; i < this.n; i++) if (known[i] === 0) return false;
    }
    for (const [a, b, same] of this.marks) {
      if (known[a] >= 0 && known[b] >= 0 && (known[a] === known[b]) !== same) return false;
    }
    for (const [t, need] of this.contour) {
      let feasible = false;
      for (const s of known[t] >= 0 ? [known[t]] : [0, 1]) {
        let d = 0, u = 0;
        for (const j of adj[t]) {
          if (known[j] === -1) u++;
          else if (known[j] !== s) d++;
        }
        if (d <= need && need <= d + u) feasible = true;
      }
      if (!feasible) return false;
    }
    for (const [t, need] of this.mosaic) {
      let L = 0, U = 0;
      for (const j of [t, ...adj[t]]) {
        if (known[j] === -1) U++;
        else if (known[j] === 1) L++;
      }
      if (L > need || L + U < need) return false;
    }
    for (const [t, need] of this.measure) {
      if (known[t] < 0) continue;
      const c = this.comp(known, t);
      if (c.length > need) return false;
      let open = false;
      for (const v of c) for (const j of adj[v]) if (known[j] === -1) open = true;
      if (!open && c.length !== need) return false;
      if (open && this.potential(known, c, known[t]).size < need) return false;
    }
    if (this.gems.size) {
      // different colours in one known component
      const owner = new Map<number, string>();
      const compId = new Int32Array(this.n).fill(-1);
      let cid = 0;
      for (const [color, list] of this.gems) {
        for (const g of list) {
          if (known[g] < 0) continue;
          if (compId[g] < 0) {
            for (const v of this.comp(known, g)) compId[v] = cid;
            cid++;
          }
          const prev = owner.get(compId[g]);
          if (prev && prev !== color) return false;
          owner.set(compId[g], color);
        }
      }
      // same colour: same state and still connectable
      for (const list of this.gems.values()) {
        let st = -1;
        for (const g of list) {
          if (known[g] < 0) continue;
          if (st === -1) st = known[g];
          else if (known[g] !== st) return false;
        }
        if (st >= 0) {
          const knownOnes = list.filter((g) => known[g] >= 0);
          const pot = this.potential(known, [knownOnes[0]], st);
          for (const g of list) if (!pot.has(g)) return false;
        }
      }
    }
    for (const h of this.parity) {
      let all = true, x = 0;
      for (let i = 0; i < this.n; i++) {
        if (!(h & (1 << i))) continue;
        if (known[i] < 0) {
          all = false;
          break;
        }
        x ^= known[i];
      }
      if (all && x) return false;
    }
    return true;
  }

  /** Local forcing to a fixpoint. Returns the number of rounds, or -1 on contradiction. */
  propagate(known: Int8Array): number {
    let rounds = 0;
    for (;;) {
      if (!this.ok(known)) return -1;
      let changed = false;
      // enumerate small local scopes: contour / mosaic / marks / parity
      const scopes: { scope: number[]; test: (k: Int8Array) => boolean }[] = [];
      for (const [t, need] of this.contour) {
        scopes.push({
          scope: [t, ...this.adj[t]],
          test: (k) => {
            let d = 0;
            for (const j of this.adj[t]) if (k[j] !== k[t]) d++;
            return d === need;
          },
        });
      }
      for (const [t, need] of this.mosaic) {
        scopes.push({
          scope: [t, ...this.adj[t]],
          test: (k) => {
            let L = k[t] === 1 ? 1 : 0;
            for (const j of this.adj[t]) if (k[j] === 1) L++;
            return L === need;
          },
        });
      }
      for (const [a, b, same] of this.marks) scopes.push({ scope: [a, b], test: (k) => (k[a] === k[b]) === same });
      for (const h of this.parity) {
        const sc: number[] = [];
        for (let i = 0; i < this.n; i++) if (h & (1 << i)) sc.push(i);
        if (sc.length <= 12) scopes.push({ scope: sc, test: (k) => sc.reduce((x, i) => x ^ k[i], 0) === 0 });
      }
      for (const { scope, test } of scopes) {
        const unk = scope.filter((i) => known[i] === -1);
        if (!unk.length || unk.length > 10) continue;
        const can0 = new Array(unk.length).fill(false);
        const can1 = new Array(unk.length).fill(false);
        let any = false;
        for (let m = 0; m < 1 << unk.length; m++) {
          unk.forEach((v, k) => (known[v] = (m >> k) & 1));
          if (test(known)) {
            any = true;
            unk.forEach((_v, k) => ((m >> k) & 1 ? (can1[k] = true) : (can0[k] = true)));
          }
        }
        unk.forEach((v) => (known[v] = -1));
        if (!any) return -1;
        unk.forEach((v, k) => {
          if (can0[k] !== can1[k]) {
            known[v] = can1[k] ? 1 : 0;
            changed = true;
          }
        });
        if (changed) break;
      }
      if (!changed) {
        // region reasoning: measure
        for (const [t, need] of this.measure) {
          if (known[t] < 0) continue;
          const s = known[t];
          const c = this.comp(known, t);
          if (c.length === need) {
            for (const v of c)
              for (const j of this.adj[v])
                if (known[j] === -1) {
                  known[j] = 1 - s;
                  changed = true;
                }
          } else {
            const pot = this.potential(known, c, s);
            if (pot.size === need) {
              for (const v of pot)
                if (known[v] === -1) {
                  known[v] = s;
                  changed = true;
                }
            }
          }
          if (changed) break;
        }
      }
      if (!changed && this.gems.size) {
        // a star touching two known components of different gems with state s cannot be s
        for (let v = 0; v < this.n && !changed; v++) {
          if (known[v] !== -1) continue;
          for (const s of [0, 1]) {
            const colors = new Set<string>();
            for (const j of this.adj[v]) {
              if (known[j] !== s) continue;
              for (const w of this.comp(known, j)) if (this.gemColor[w]) colors.add(this.gemColor[w]!);
            }
            if (this.gemColor[v]) {
              for (const j of this.adj[v]) {
                if (known[j] !== s) continue;
                for (const w of this.comp(known, j)) if (this.gemColor[w] && this.gemColor[w] !== this.gemColor[v]) colors.add('x');
              }
            }
            if (colors.size >= 2) {
              known[v] = 1 - s;
              changed = true;
              break;
            }
          }
        }
      }
      if (!changed && this.allLit) {
        for (let i = 0; i < this.n; i++)
          if (known[i] === -1) {
            known[i] = 1;
            changed = true;
          }
      }
      if (!changed) return rounds;
      rounds++;
    }
  }
}

// ───────────────────────── DFS solver ─────────────────────────

export interface GraphSolveResult {
  solutions: Uint8Array[];
  complete: boolean;
  nodes: number;
}

export function solveConstellation(def: ConstellationDef, opts: { maxSolutions?: number; nodeLimit?: number } = {}): GraphSolveResult {
  const maxSolutions = opts.maxSolutions ?? 2;
  const nodeLimit = opts.nodeLimit ?? 4_000_000;
  const R = new Reasoner(def);
  const n = R.n;
  const known = new Int8Array(n).fill(-1);
  def.stars.forEach((s, i) => {
    if (s.lock !== undefined) known[i] = s.lock;
  });
  // variable order: BFS from the most constrained star
  const weight = (i: number) => (def.stars[i].glyph ? 3 : 0) + R.adj[i].length;
  const order: number[] = [];
  const seen = new Set<number>();
  const startCandidates = [...Array(n).keys()].sort((a, b) => weight(b) - weight(a));
  for (const s0 of startCandidates) {
    if (seen.has(s0)) continue;
    const q = [s0];
    seen.add(s0);
    while (q.length) {
      // pick the most constrained frontier star first
      q.sort((a, b) => weight(b) - weight(a));
      const v = q.shift()!;
      order.push(v);
      for (const j of R.adj[v])
        if (!seen.has(j)) {
          seen.add(j);
          q.push(j);
        }
    }
  }
  const solutions: Uint8Array[] = [];
  let nodes = 0;
  let aborted = false;
  const dfs = (k: number) => {
    if (aborted || solutions.length >= maxSolutions) return;
    if (k === n) {
      const st = Uint8Array.from(known, (v) => (v === 1 ? 1 : 0));
      if (checkConstellation(def, st).ok && reachable(def, st)) solutions.push(st);
      return;
    }
    const v = order[k];
    if (known[v] !== -1) {
      if (R.ok(known)) dfs(k + 1);
      return;
    }
    for (const b of [1, 0]) {
      if (++nodes > nodeLimit) {
        aborted = true;
        return;
      }
      known[v] = b;
      if (R.ok(known)) dfs(k + 1);
      known[v] = -1;
      if (aborted || solutions.length >= maxSolutions) return;
    }
  };
  dfs(0);
  return { solutions, complete: !aborted, nodes };
}

/** Number of solutions modulo the global inversion symmetry (when the rules are symmetric). */
export function distinctSolutions(def: ConstellationDef, symmetric: boolean, max = 3, nodeLimit?: number): { count: number; complete: boolean; first: Uint8Array | null } {
  const r = solveConstellation(def, { maxSolutions: symmetric ? max * 2 : max, nodeLimit });
  if (!symmetric) return { count: r.solutions.length, complete: r.complete, first: r.solutions[0] ?? null };
  const keys = new Set<string>();
  for (const s of r.solutions) {
    const a = Array.from(s).join('');
    const b = Array.from(s, (v) => 1 - v).join('');
    keys.add(a < b ? a : b);
  }
  return { count: keys.size, complete: r.complete, first: r.solutions[0] ?? null };
}

// ───────────────────────── difficulty ─────────────────────────

export interface DifficultyReport {
  solvedByLogic: boolean;
  rounds: number;
  lookaheads: number;
  deep: number;
  presses: number;
  score: number;
}

/** Simulates a careful human: local deductions, then single-assumption contradictions, then
 *  nested assumptions. Score grows with size and with how deep the reasoning must go. */
export function estimateDifficulty(def: ConstellationDef, solution?: Uint8Array): DifficultyReport {
  const R = new Reasoner(def);
  const n = R.n;
  const known = new Int8Array(n).fill(-1);
  def.stars.forEach((s, i) => {
    if (s.lock !== undefined) known[i] = s.lock;
  });
  let rounds = 0, lookaheads = 0, deep = 0;
  let solvedByLogic = true;
  // symmetric rule sets: fix one star (the player is free to pick a "colour" for the first region)
  const symmetric = !R.allLit && !def.stars.some((s) => s.lock !== undefined || s.glyph?.kind === 'mosaic');
  if (symmetric && solution) {
    const anchor = def.stars.findIndex((s) => s.glyph);
    known[anchor >= 0 ? anchor : 0] = solution[anchor >= 0 ? anchor : 0];
  }
  const tryContra = (base: Int8Array, v: number, b: number, depth: number): boolean => {
    const k = base.slice();
    k[v] = b;
    const r = R.propagate(k);
    if (r < 0) return true;
    if (depth > 0) {
      // nested: does every assumption on some other star lead to contradiction?
      for (let w = 0; w < n; w++) {
        if (k[w] !== -1) continue;
        if (tryContra(k, w, 0, 0) && tryContra(k, w, 1, 0)) return true;
      }
    }
    return false;
  };
  for (let guard = 0; guard < 200; guard++) {
    const r = R.propagate(known);
    if (r < 0) {
      solvedByLogic = false;
      break;
    }
    rounds += r;
    if (!known.includes(-1)) break;
    let progressed = false;
    for (let depth = 0; depth <= 1 && !progressed; depth++) {
      for (let v = 0; v < n && !progressed; v++) {
        if (known[v] !== -1) continue;
        for (const b of [0, 1]) {
          if (tryContra(known, v, b, depth)) {
            known[v] = 1 - b;
            if (depth === 0) lookaheads++;
            else deep++;
            progressed = true;
            break;
          }
        }
      }
    }
    if (!progressed) {
      solvedByLogic = false;
      break;
    }
  }
  if (known.includes(-1)) solvedByLogic = false;
  let presses = 0;
  if (def.echo && solution) presses = pressesFor(def, solution)?.length ?? 0;
  const kinds = new Set<string>(def.stars.filter((s) => s.glyph).map((s) => s.glyph!.kind));
  if (def.threads.some((t) => t.mark)) kinds.add('mark');
  let score = 0.6 + 0.09 * n + 0.18 * rounds + 0.9 * lookaheads + 2.6 * deep + 0.45 * Math.max(0, kinds.size - 1);
  if (def.echo) score += 0.5 + 0.35 * presses + (R.parity.length ? 0.6 : 0);
  if (!solvedByLogic) score += 3;
  return { solvedByLogic, rounds, lookaheads, deep, presses, score };
}
