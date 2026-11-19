/**
 * Read-only inspection of the real story in Notion.
 *
 * Downloads the page's complete block tree, exactly as the API returns it, into
 * a private local file, and prints how many blocks of each type it contains.
 * This is for studying the API's shape. It is not the app's content source:
 * the app renders `src/fixture.ts`.
 *
 *   NOTION_API_TOKEN=... NOTION_PAGE_ID=... npm run inspect:notion
 */

import { mkdir, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { createNotionClient, type NotionBlock } from './notion-client.ts';

// Outside the repository and Vite's web root, so draft content can't be
// committed or end up in build output.
const SNAPSHOT_DIR = join(homedir(), '.fakestory-private');
const SNAPSHOT_FILE = join(SNAPSHOT_DIR, 'notion-blocks.json');

// A page ID, with or without dashes.
const PAGE_ID_PATTERN = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const pageId = process.env.NOTION_PAGE_ID;
if (!pageId || !PAGE_ID_PATTERN.test(pageId)) {
  console.error('Set NOTION_PAGE_ID to a page UUID.');
  process.exit(1);
}

try {
  const client = createNotionClient({ token: process.env.NOTION_API_TOKEN });
  const blocks = await client.tree(pageId);

  await writeSnapshot({ pageId, blocks });

  // Print counts only, never story text, so the output is safe to share.
  console.log('Saved a private local block snapshot. Block counts:', countBlockTypes(blocks));
  console.log('This file is not used by the app or deployment. Never commit or share it.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Notion inspection failed.');
  process.exitCode = 1;
}

/**
 * Write to a temporary file, then rename it into place. The rename is atomic,
 * so a failed or interrupted run never leaves a half-written snapshot, and the
 * last good snapshot survives until a new one is complete.
 */
async function writeSnapshot(snapshot: { pageId: string; blocks: NotionBlock[] }) {
  const tempFile = `${SNAPSHOT_FILE}.tmp`;

  // Readable by the current user only.
  await mkdir(SNAPSHOT_DIR, { recursive: true, mode: 0o700 });
  await writeFile(tempFile, JSON.stringify(snapshot, null, 2), { mode: 0o600 });

  await rename(tempFile, SNAPSHOT_FILE);
}

function countBlockTypes(blocks: NotionBlock[], counts: Record<string, number> = {}) {
  for (const block of blocks) {
    counts[block.type] = (counts[block.type] ?? 0) + 1;

    if (block.children) {
      countBlockTypes(block.children, counts);
    }
  }

  return counts;
}
