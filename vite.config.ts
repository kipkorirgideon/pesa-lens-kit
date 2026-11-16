import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Hard budget (kB, as Vite counts: 1 kB = 1000 bytes) for any single emitted JS chunk. */
const CHUNK_BUDGET_KB = 500;

/** Fails the build, not just warns, when a JS chunk exceeds the budget. */
function chunkBudget(): Plugin {
  return {
    name: 'chunk-budget',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const [file, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') continue;
        const kb = Buffer.byteLength(chunk.code) / 1000;
        if (kb > CHUNK_BUDGET_KB) {
          this.error(`Chunk ${file} is ${kb.toFixed(2)} kB, over the ${CHUNK_BUDGET_KB} kB budget.`);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), chunkBudget()],
  build: { chunkSizeWarningLimit: CHUNK_BUDGET_KB },
});
