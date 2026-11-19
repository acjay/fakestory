/**
 * Fails the build if anything that could expose the private story snapshot
 * made it into `dist/`. Run automatically by `npm run build`.
 *
 * The dev-only loader (src/loadStory.ts) and its server route
 * (vite.config.ts) should be stripped from production output entirely.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist';

// Strings that only appear in the dev-only loading code or the snapshot path.
const FORBIDDEN = ['/__local/story.json', '.fakestory-private'];

const files = await readdir(DIST, { recursive: true, withFileTypes: true });
const leaks: string[] = [];

for (const file of files.filter((entry) => entry.isFile())) {
  const path = join(file.parentPath, file.name);
  const contents = await readFile(path, 'utf8');

  for (const forbidden of FORBIDDEN) {
    if (contents.includes(forbidden)) {
      leaks.push(`${path} contains "${forbidden}"`);
    }
  }
}

if (leaks.length > 0) {
  console.error('Build contains local-only story loading code:\n' + leaks.join('\n'));
  process.exit(1);
}

console.log(`Checked ${files.length} build files: no local story references.`);
