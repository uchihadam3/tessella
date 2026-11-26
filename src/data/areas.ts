/**
 * Area catalogue: the contract between puzzle content (src/data/puzzles/*) and the world
 * builders (src/world/areas/*). Group sizes here are authoritative — every puzzle file must
 * provide exactly `count` puzzles per group, in teaching order.
 */

export type AreaId =
  | 'prologue'
  | 'hub'
  | 'kinship'
  | 'measure'
  | 'mold'
  | 'contour'
  | 'mosaic'
  | 'beacon'
  | 'weave'
  | 'twins'
  | 'citadel'
  | 'echo'
  | 'spire';

export interface GroupSpec {
  key: string;
  count: number;
  /** what this group is for (design intent) */
  role: string;
}

export interface AreaSpec {
  id: AreaId;
  /** area number shown to the player (1..11); 0 = prologue/hub */
  number: number;
  name: { pt: string; en: string };
  /** name of the language (rule) taught here */
  rule?: { pt: string; en: string };
  /** glyph kind taught (for icons) */
  glyph?: 'gem' | 'measure' | 'mold' | 'contour' | 'mosaic' | 'beacon' | 'weave' | 'twin' | 'echo' | 'mix';
  /** lit-tile colour and accent colour */
  lit: string;
  accent: string;
  /** world anchor (x, z) in metres; north is -z */
  anchor: [number, number];
  groups: GroupSpec[];
  /** has a totem that lights when every panel of the area is solved */
  totem: boolean;
}

/** Teaching areas: 7 teaching panels, then 38 ever-harder panels of the same language, organised
 *  in sequences of 4 (each sequence explores one insight from simple to genuinely hard). */
const OPEN_GROUPS = (intro: string, practice: string, trial: string, heart: string, introCount = 20): GroupSpec[] => [
  { key: 'intro', count: introCount, role: intro },
  { key: 'practice', count: 12, role: practice + ' (3 insight sequences of 4)' },
  { key: 'trial', count: 12, role: trial + ' (3 harder insight sequences of 4)' },
  { key: 'mastery', count: 8, role: 'two sequences combining the insights' },
  { key: 'heart', count: 6, role: heart + ' — showpieces' },
];

export const AREAS: AreaSpec[] = [
  {
    id: 'prologue', number: 0, name: { pt: 'O Despertar', en: 'The Awakening' },
    lit: '#ffd29a', accent: '#f2b766', anchor: [0, 300], totem: false,
    groups: [
      { key: 'cave', count: 5, role: 'interface: press, light, seal, rivets, holes; copy the plate; read the light from the window' },
      { key: 'shore', count: 1, role: 'read a pattern from the world (standing stones on the beach)' },
      { key: 'gate', count: 2, role: 'first taste of borders/regions; opens the way to the island' },
    ],
  },
  {
    id: 'hub', number: 0, name: { pt: 'O Pátio das Nove Luzes', en: 'Court of Nine Lights' },
    lit: '#ffe2a8', accent: '#f0c674', anchor: [0, 0], totem: false, groups: [],
  },
  {
    id: 'kinship', number: 1, name: { pt: 'O Bosque Outonal', en: 'The Autumn Grove' },
    rule: { pt: 'Afinidade', en: 'Kinship' }, glyph: 'gem',
    lit: '#ffa94d', accent: '#e0622f', anchor: [-190, -110], totem: true,
    groups: OPEN_GROUPS('learn separate/join', 'three colours, holes', 'four+ colours, tight topology', 'mastery'),
  },
  {
    id: 'measure', number: 2, name: { pt: 'Os Terraços', en: 'The Terraces' },
    rule: { pt: 'Medida', en: 'Measure' }, glyph: 'measure',
    lit: '#c8ec6e', accent: '#7fb33a', anchor: [190, -110], totem: true,
    groups: OPEN_GROUPS('regions have size; darkness counts', 'many numbers', 'big background regions', 'mastery'),
  },
  {
    id: 'mold', number: 3, name: { pt: 'A Pedreira', en: 'The Quarry' },
    rule: { pt: 'Forma', en: 'Mold' }, glyph: 'mold',
    lit: '#f5ecd7', accent: '#c9a46b', anchor: [75, -207], totem: true,
    groups: OPEN_GROUPS('regions have shape; orientation; dark molds; free molds', 'interlocking', 'pentominoes', 'mastery'),
  },
  {
    id: 'contour', number: 4, name: { pt: 'O Jardim de Sebes', en: 'The Hedge Garden' },
    rule: { pt: 'Contorno', en: 'Contour' }, glyph: 'contour',
    lit: '#56e3a4', accent: '#2f9d6b', anchor: [-141, 169], totem: true,
    groups: OPEN_GROUPS('count glowing sides; outside is dark', 'chains of deduction', 'sparse clues', 'mastery'),
  },
  {
    id: 'mosaic', number: 5, name: { pt: 'O Templo das Areias', en: 'The Sand Temple' },
    rule: { pt: 'Caminho', en: 'Path' }, glyph: 'mosaic',
    lit: '#4fd8e0', accent: '#d9a441', anchor: [141, 169], totem: true,
    groups: [
      { key: 'gate', count: 12, role: 'the language, one idea at a time: join the wells with light; waymarks on the way; rocks and dark rivets block; a path never touches itself; two colours never touch' },
      { key: 'light', count: 4, role: 'pergolas: the light on the floor shows the path; sand hides part (deduce it, or read the lattice from below)' },
      { key: 'tower', count: 3, role: 'glazed flagstones seen from a tower are the path; an awning hides a corner (walk under it); a dune buries part' },
      { key: 'roof', count: 4, role: 'panels on the sanctuary roof that show no waymarks: they are inlaid in the floor below each edge' },
      { key: 'heart', count: 3, role: 'the hard ones: long paths between rocks, waymarks and a second colour' },
    ],
  },
  {
    id: 'beacon', number: 6, name: { pt: 'Os Penhascos dos Faróis', en: 'The Lighthouse Cliffs' },
    rule: { pt: 'Farol', en: 'Beacon' }, glyph: 'beacon',
    lit: '#ffd66b', accent: '#f0f0f0', anchor: [286, 50], totem: true,
    groups: OPEN_GROUPS('beacons see in lines; all light needs a source', 'beacons see each other', 'rocks and crossing beams', 'mastery'),
  },
  {
    id: 'weave', number: 7, name: { pt: 'O Vale dos Moinhos', en: 'The Windmill Vale' },
    rule: { pt: 'Trama', en: 'Weave' }, glyph: 'weave',
    lit: '#b993ff', accent: '#e7c35a', anchor: [-75, -207], totem: true,
    groups: OPEN_GROUPS('threads are runs; gaps between runs', 'pictures of the vale', 'broken threads (holes)', 'mastery pictures'),
  },
  {
    id: 'twins', number: 8, name: { pt: 'O Lago Espelhado', en: 'The Mirror Lake' },
    rule: { pt: 'Gêmeos', en: 'Twins' }, glyph: 'twin',
    lit: '#ffa8d4', accent: '#e34f6e', anchor: [-217, 38], totem: true,
    groups: OPEN_GROUPS('two separate regions, same shape', 'lit twins dark; mirror twins', 'several pairs', 'mastery'),
  },
  {
    id: 'citadel', number: 9, name: { pt: 'A Cidadela', en: 'The Citadel' },
    rule: { pt: 'Todas as linguagens', en: 'Every language' }, glyph: 'mix',
    lit: '#e8a560', accent: '#9c6b3c', anchor: [0, -440], totem: true,
    groups: [
      { key: 'gate', count: 6, role: 'two languages per panel' },
      { key: 'court', count: 10, role: 'two languages, deeper interactions' },
      { key: 'halls', count: 14, role: 'three languages' },
      { key: 'crown', count: 10, role: 'three or four languages incl. echo; the hardest of the island' },
    ],
  },
  {
    id: 'echo', number: 10, name: { pt: 'A Caverna Ressonante', en: 'The Resonant Hollow' },
    rule: { pt: 'Eco', en: 'Echo' }, glyph: 'echo',
    lit: '#63f0ff', accent: '#8a6bff', anchor: [0, -60], totem: true,
    groups: [
      { key: 'intro', count: 7, role: 'pressing echoes; mute tiles; copy crystal plates' },
      { key: 'practice', count: 9, role: 'echo puzzles with plates, bigger' },
      { key: 'trial', count: 9, role: 'echo + a known language' },
      { key: 'heart', count: 5, role: 'mastery' },
    ],
  },
  {
    id: 'spire', number: 11, name: { pt: 'A Torre do Céu', en: 'The Sky Spire' },
    rule: { pt: 'Tudo', en: 'Everything' }, glyph: 'mix',
    lit: '#e8f0ff', accent: '#ffd88a', anchor: [0, -95], totem: false,
    groups: [
      { key: 'ascent', count: 8, role: 'combinations, rising' },
      { key: 'drums', count: 6, role: 'drum panels: the edges meet (wrap)' },
      { key: 'mirrors', count: 6, role: 'mirror input' },
      { key: 'apex', count: 4, role: 'the finale' },
    ],
  },
];

export const AREA_BY_ID: Record<AreaId, AreaSpec> = Object.fromEntries(AREAS.map((a) => [a.id, a])) as Record<AreaId, AreaSpec>;

/** The eight open teaching areas (their totems count towards opening the Hollow). */
export const TEACHING_AREAS: AreaId[] = ['kinship', 'measure', 'mold', 'contour', 'mosaic', 'beacon', 'weave', 'twins'];
export const TOTEMS_TO_OPEN_ECHO = 7;

/** Environmental secrets (optional "world tesserae" built from objects of the landscape):
 *  how many each place hides (group key 'secret'). */
export const SECRET_COUNTS: Partial<Record<AreaId, number>> = {
  prologue: 1, hub: 1, kinship: 2, measure: 2, mold: 2, contour: 2, mosaic: 2, beacon: 2, weave: 2, twins: 2, citadel: 2, echo: 1, spire: 1,
};
export const SECRET_AREAS: AreaId[] = Object.keys(SECRET_COUNTS) as AreaId[];
export const SECRET_TOTAL = Object.values(SECRET_COUNTS).reduce((s, n) => s + (n ?? 0), 0);

/** The Hidden Vault opens when every world secret is solved. It holds one puzzle:
 *  'hub.vault' (group key 'vault' in the hub's puzzle set) — the hardest puzzle of the island. */
export const VAULT_PUZZLE_ID = 'hub.vault';

export function puzzleCount(id: AreaId): number {
  return AREA_BY_ID[id].groups.reduce((s, g) => s + g.count, 0);
}
