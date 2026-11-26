// Rewrites the <hand> intro list of an area from a plan: each entry is either { old: n } (keep the
// old intro n, renumbered) or a new panel { grid, note, shapes?, rows?, cols? }.
// Usage: node tools/rewrite-intros.cjs plan.json   (plan: { area: [entries...] })
const fs = require('fs');
const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const [area, list] of Object.entries(plan)) {
  const file = `src/data/puzzles/${area}.ts`;
  const src = fs.readFileSync(file, 'utf8');
  const start = src.indexOf('  intro: [\n');
  const end = src.indexOf('\n  ],', start);
  const body = src.slice(start + '  intro: [\n'.length, end);
  const blocks = body.split(/\n(?=    puzzle\()/).map((b) => b.replace(/\n+$/, ''));
  const old = {};
  for (const b of blocks) {
    const m = b.match(/puzzle\('[a-z]+\.intro\.(\d+)'/);
    if (m) old[+m[1]] = b;
  }
  const out = list.map((e, i) => {
    const id = `${area}.intro.${i + 1}`;
    if (e.old) {
      if (!old[e.old]) throw new Error(`${area}: no old intro ${e.old}`);
      return old[e.old].replace(/puzzle\('[a-z]+\.intro\.\d+'/, `puzzle('${id}'`);
    }
    const rows = e.grid.split('\n');
    const w = Math.max(...rows.flatMap((r) => r.trim().split(/\s+/).map((t) => t.length)));
    const grid = rows.map((r) => '        ' + r.trim().split(/\s+/).map((t) => t.padEnd(w)).join(' ').trimEnd()).join('\n');
    let s = `    puzzle('${id}', {\n      grid: \`\n${grid}\n      \`,\n`;
    if (e.shapes) s += `      shapes: { ${Object.entries(e.shapes).map(([k, v]) => `${k}: '${v}'`).join(', ')} },\n`;
    if (e.rows) s += `      rows: '${e.rows}',\n`;
    if (e.cols) s += `      cols: '${e.cols}',\n`;
    s += `      difficulty: 1,\n      note: ${JSON.stringify(e.note).replace(/^"|"$/g, "'")},\n    }),`;
    return s;
  });
  fs.writeFileSync(file, src.slice(0, start) + '  intro: [\n' + out.join('\n') + src.slice(end));
  console.log(area, out.length, 'intro panels; mapping new→old', JSON.stringify(list.map((e) => e.old || 0)));
}
