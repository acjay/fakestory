import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/** Where `npm run import:notion` writes the private story snapshot. */
const LOCAL_STORY_FILE = join(homedir(), '.fakestory-private', 'story.json');

/** The dev-server URL the app fetches it from (see src/loadStory.ts). */
const LOCAL_STORY_URL = '/__local/story.json';

export default defineConfig({
  plugins: [react(), localStory()],
  build: {
    rollupOptions: {
      // The reading page, plus one standalone page per demo (demos/<slug>/index.html).
      // The dev-only harness pages are deliberately not listed.
      input: { main: resolve('index.html'), ...demoPages() },
    },
  },
});

/** Every demos/<slug>/index.html, keyed for the build as demos/<slug>. */
function demoPages(): Record<string, string> {
  const slugs = readdirSync('demos', { withFileTypes: true }).filter((entry) => entry.isDirectory());
  return Object.fromEntries(slugs.map((entry) => [`demos/${entry.name}`, resolve('demos', entry.name, 'index.html')]));
}

/**
 * Serves the private story snapshot to the local dev server, so the real
 * story can be previewed with `npm run dev:story`.
 *
 * Only active for `vite` (serve), never `vite build`, and only when
 * VITE_LOCAL_STORY=1. The file is read on each request and never copied into
 * the project, so it can't end up in build output. `npm run build` also runs
 * scripts/check-build.ts to make sure of that.
 */
function localStory(): Plugin {
  return {
    name: 'fakestory-local-story',
    apply: 'serve',

    configureServer(server) {
      if (process.env.VITE_LOCAL_STORY !== '1') {
        return;
      }

      server.middlewares.use(LOCAL_STORY_URL, async (_request, response) => {
        try {
          const story = await readFile(LOCAL_STORY_FILE, 'utf8');
          response.setHeader('Content-Type', 'application/json');
          response.setHeader('Cache-Control', 'no-store');
          response.end(story);
        } catch {
          response.statusCode = 404;
          response.end(`No story snapshot at ${LOCAL_STORY_FILE}. Run npm run import:notion first.`);
        }
      });
    },
  };
}
