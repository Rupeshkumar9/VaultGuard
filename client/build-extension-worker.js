import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'vite';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

await build({
  configFile: false,
  resolve: {
    // The worker entry lives outside client/, so Vite does not search the
    // client dependency tree for package imports by default.
    alias: {
      '@serenity-kit/opaque': path.resolve(currentDir, 'node_modules/@serenity-kit/opaque'),
    },
  },
  build: {
    emptyOutDir: true,
    outDir: path.resolve(currentDir, '../extension/worker-dist'),
    codeSplitting: false,
    lib: {
      entry: path.resolve(currentDir, '../extension/background.js'),
      formats: ['es'],
      fileName: () => 'background.js',
    },
    minify: true,
  },
});

console.log('Built hardened extension service worker.');
