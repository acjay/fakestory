import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // The reading page, the demo index, and one standalone page per demo (demos/<slug>/index.html).
      // The dev-only harness pages are deliberately not listed.
      input: { main: resolve('index.html'), demos: resolve('demos/index.html'), ...demoPages() },
    },
  },
});

/** Every demos/<slug>/index.html, keyed for the build as demos/<slug>. */
function demoPages(): Record<string, string> {
  const slugs = readdirSync('demos', { withFileTypes: true }).filter((entry) => entry.isDirectory());
  return Object.fromEntries(slugs.map((entry) => [`demos/${entry.name}`, resolve('demos', entry.name, 'index.html')]));
}
