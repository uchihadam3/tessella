/**
 * Insight-driven curation: every post-teaching panel must have a human solve path whose
 * bottleneck is a nameable "ahá" (see solver.insightPath). We generate pools, measure the
 * path of each candidate, keep only fair ones (no guessing beyond short "what if"s),
 * rank them, and write notes that name the actual insights.
 */
import { insightPath } from '../../src/puzzle/solver';
import type { PuzzleDef } from '../../src/puzzle/types';
import { generate, type Candidate, type Spec } from './gen';
import type { Rng } from './random-puzzle';

export type Level = 'practice' | 'trial' | 'heart';

/** Portuguese names of the insights (shown in docs / notes). */
export const PHRASE: Record<string, string> = {
  'measure-exit': 'uma região que ainda precisa crescer tem uma só saída — ela passa por ali',
  'measure-fill': 'o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz',
  'measure-room': 'um número que não cabe de um lado da luz só pode estar do outro',
  'mold-exit': 'o molde incompleto só tem uma saída',
  'mold-room': 'na luz o molde não cabe — ele é esculpido na sombra (ou o contrário)',
  'mold-place': 'só existe um encaixe para o molde',
  'twin-place': 'a cópia só cabe num lugar',
  'mosaic-pair': 'duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga',
  'beacon-single': 'só um farol alcança aquela luz — o caminho até ela acende',
  'kin-state': 'uma família que não consegue se unir de um lado da luz tem de estar do outro',
  'kin-cut': 'um gargalo: o único caminho que liga as gemas',
};

export const LOOK_PHRASE: Record<string, string> = {
  contour: 'imagine o ladrilho aceso — a pista vizinha ganharia bordas demais',
  measure: 'imagine a região um ladrilho maior — o número estouraria',
  mosaic: 'imagine aquele ladrilho aceso — uma janela passaria da conta',
  beacon: 'imagine uma luz ali — algum farol veria demais',
  mold: 'imagine o ladrilho do outro jeito — o molde não fecharia',
  gem: 'imagine o caminho por ali — duas famílias se tocariam',
  twin: 'imagine a cópia ali — ela invadiria a outra',
  weave: 'imagine a sequência ali — o fio não fecharia',
  default: 'imagine o ladrilho do outro jeito — uma pista quebraria na hora',
};

export interface Stats {
  solved: boolean;
  basicRoot: number;
  steps: number;
  named: string[]; // distinct named insights, in order of first use
  looks: number;
  maxCascade: number;
}

export function stats(c: Candidate): Stats {
  const ip = c.ip ?? insightPath(c.p, 60);
  c.ip = ip;
  const named: string[] = [];
  let looks = 0;
  let maxCascade = 0;
  for (const s of ip.steps) {
    if (s.tag === 'lookahead') looks++;
    else if (!named.includes(s.tag)) named.push(s.tag);
    maxCascade = Math.max(maxCascade, s.direct + s.cascade);
  }
  return { solved: ip.solved, basicRoot: ip.basicRoot, steps: ip.steps.length, named, looks, maxCascade };
}

function free(p: PuzzleDef): number {
  return p.cells.filter((c) => !c.hole && c.lock === undefined).length;
}

export function score(c: Candidate): number {
  const s = stats(c);
  return (1 - s.basicRoot) * 3 + s.named.length * 2 + Math.min(s.steps, 10) * 0.4 + s.looks * 0.35;
}
export function showScore(c: Candidate): number {
  const s = stats(c);
  return s.named.length * 3 + (1 - s.basicRoot) * 3 + (s.maxCascade / Math.max(1, free(c.p))) * 3 + Math.min(s.steps, 8) * 0.3;
}

/** Collects up to `max` distinct candidates. */
export function pool(r: Rng, make: () => Candidate | null, tries: number, max: number): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (let k = 0; k < tries && out.length < max; k++) {
    const c = make();
    if (!c) continue;
    const key = JSON.stringify(c.p.cells) + JSON.stringify(c.p.rowClues ?? '') + JSON.stringify(c.p.colClues ?? '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export function poolSpec(r: Rng, spec: Spec, tries: number, max: number): Candidate[] {
  return pool(r, () => generate(r, spec), tries, max);
}

export interface CurateOpts {
  /** puzzles whose rules allow several solutions (kinship/twins): do not require a full solve */
  open?: boolean;
  /** insight tags at least one of which must appear */
  needAny?: string[];
  /** minimum distinct named insights */
  minNamed?: number;
}

const LIMITS: Record<Level, { minSteps: number; maxLooks: number; maxBasic: number }> = {
  practice: { minSteps: 1, maxLooks: 2, maxBasic: 0.95 },
  trial: { minSteps: 2, maxLooks: 4, maxBasic: 0.75 },
  heart: { minSteps: 3, maxLooks: 8, maxBasic: 0.6 },
};

/** Picks `need` puzzles forming an easy→hard ramp; for hearts the last ones are showpieces. */
export function curate(list: Candidate[], need: number, level: Level, label: string, o: CurateOpts = {}): Candidate[] {
  const ok = (c: Candidate, relax: number) => {
    const s = stats(c);
    const L = LIMITS[level];
    if (!o.open && !s.solved) return false;
    if (s.steps < Math.max(0, L.minSteps - relax)) return false;
    if (s.looks > L.maxLooks + relax * 2) return false;
    if (s.basicRoot > Math.min(1, L.maxBasic + relax * 0.15)) return false;
    if (o.needAny && !s.named.some((t) => o.needAny!.includes(t))) return relax >= 2;
    if (o.minNamed && s.named.length < o.minNamed - relax) return false;
    return true;
  };
  let chosen: Candidate[] = [];
  for (let relax = 0; relax <= 4; relax++) {
    chosen = list.filter((c) => ok(c, relax));
    if (chosen.length >= need) {
      if (relax) console.warn(`  ${label}: relaxed curation x${relax} (${chosen.length} candidates)`);
      break;
    }
  }
  if (chosen.length < need) {
    console.warn(`  ${label}: only ${chosen.length} curated, filling from pool`);
    chosen = [...chosen, ...list.filter((c) => !chosen.includes(c) && (o.open || stats(c).solved))].slice(0, Math.max(need, chosen.length));
  }
  chosen.sort((a, b) => score(a) - score(b));
  if (level !== 'heart' || chosen.length <= need) {
    // spread across the ramp
    if (chosen.length <= need) return chosen;
    const out: Candidate[] = [];
    for (let i = 0; i < need; i++) out.push(chosen[Math.round((i * (chosen.length - 1)) / Math.max(1, need - 1))]);
    return [...new Set(out)].length === need ? out : chosen.slice(-need);
  }
  // hearts: the last three are the best showpieces, the rest ramp up to them
  const shows = [...chosen].sort((a, b) => showScore(b) - showScore(a)).slice(0, Math.min(3, need));
  const rest = chosen.filter((c) => !shows.includes(c));
  const front: Candidate[] = [];
  const k = need - shows.length;
  for (let i = 0; i < k; i++) front.push(rest[Math.round(((i + 1) * (rest.length - 1)) / Math.max(1, k))]);
  return [...new Set([...front, ...shows.sort((a, b) => showScore(a) - showScore(b))])].slice(0, need);
}

/** Note that names the real insights of the puzzle. */
export function insightNote(c: Candidate, lang: string, feature?: string): string {
  const s = stats(c);
  const parts: string[] = [];
  if (s.named.length) parts.push(`Ahá: ${PHRASE[s.named[0]] ?? s.named[0]}`);
  else if (s.looks) parts.push(`Ahá: ${LOOK_PHRASE[lang] ?? LOOK_PHRASE.default}`);
  if (s.named.length > 1) parts.push(`depois: ${PHRASE[s.named[1]] ?? s.named[1]}`);
  if (s.named.length > 2) parts.push(`e por fim: ${PHRASE[s.named[2]] ?? s.named[2]}`);
  if (s.named.length && s.looks) parts.push(`(${s.looks === 1 ? 'um' : s.looks} "e se?" no caminho)`);
  let note = parts.join('; ');
  if (feature) note = `${feature}. ${note}`;
  return note.endsWith('.') ? note : note + '.';
}
