import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// a version per build: date + commit, shown nowhere but used to detect updates
function buildVersion(): string {
  let hash = 'dev';
  try {
    hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    /* not a git checkout */
  }
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}.${d.getUTCMonth() + 1}.${d.getUTCDate()}-${d.getUTCHours()}${String(d.getUTCMinutes()).padStart(2, '0')}`;
  return `${stamp}-${hash}`;
}
const VERSION = buildVersion();

// writes dist/sw.js (the installed game's offline cache + auto-update) stamped with this build's version
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'tessella-sw',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const src = readFileSync(resolve('tools/sw-template.js'), 'utf8').replace('__VERSION__', VERSION);
      writeFileSync(resolve(outDir, 'sw.js'), src);
      // the game's (large) script goes to the end of the page, so the page shows "loading" at once
      // instead of nothing until all of it is read (an installed app stays on its splash till then)
      const page = resolve(outDir, 'index.html');
      let html = readFileSync(page, 'utf8');
      const m = html.match(/\s*<script type="module"[^>]*>[\s\S]*?<\/script>/);
      if (m && html.indexOf(m[0]) < html.indexOf('<body')) {
        // (plain slicing: the script itself is full of "$" that String.replace would read as patterns)
        const at = html.indexOf(m[0]);
        html = html.slice(0, at) + html.slice(at + m[0].length);
        const end = html.lastIndexOf('</body>');
        html = html.slice(0, end) + m[0].trim() + '\n' + html.slice(end);
        writeFileSync(page, html);
      }
    },
  };
}

// The whole game builds into ONE self-contained index.html (code, fonts, images
// inlined) so it can be played fully offline by just opening the file. The files in
// public/ (manifest, icons) plus sw.js make the hosted copy installable.
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(VERSION) },
  plugins: [viteSingleFile({ removeViteModuleLoader: true }), serviceWorker()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 100_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
  server: { host: true, port: 5173 },
});
