// Turns the single-file build into an Artifact page body (the publisher adds the HTML skeleton).
// usage: node scripts/make-artifact.mjs dist/index.html <out.html>
import { readFileSync, writeFileSync } from 'node:fs';
const [, , src = 'dist/index.html', out = 'artifact.html'] = process.argv;
let html = readFileSync(src, 'utf8');
html = html
  .replace(/<!doctype html>/i, '')
  .replace(/<html[^>]*>/i, '')
  .replace(/<\/html>/i, '')
  .replace(/<head>/i, '')
  .replace(/<\/head>/i, '')
  .replace(/<body>/i, '')
  .replace(/<\/body>/i, '')
  .replace(/<meta charset="UTF-8"\s*\/?>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '');
// title first (only the first 8KB is scanned for it)
const title = html.match(/<title>[^<]*<\/title>/i)?.[0] ?? '<title>TESSELLA</title>';
html = title + '\n' + html.replace(title, '');
writeFileSync(out, html.trim() + '\n');
console.log('wrote', out, (html.length / 1024 / 1024).toFixed(2) + ' MB');
