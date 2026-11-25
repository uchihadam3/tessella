import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The whole game builds into ONE self-contained index.html (code, fonts, images
// inlined) so it can be played fully offline by just opening the file.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 100_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
  server: { host: true, port: 5173 },
});
