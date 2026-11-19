import { mkdir, writeFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createNotionClient } from './notion-client.mjs';

const pageId = process.env.NOTION_PAGE_ID;
if (!pageId || !/^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(pageId)) {
  console.error('Set NOTION_PAGE_ID to a page UUID.'); process.exit(1);
}
try {
  const blocks = await createNotionClient({ token: process.env.NOTION_API_TOKEN }).tree(pageId);
  const counts = {};
  function count(items) { for (const block of items) { counts[block.type] = (counts[block.type] || 0) + 1; if (block.children) count(block.children); } }
  count(blocks);
  // Outside the repository and Vite's web root; no draft content in build output.
  const dir = join(homedir(), '.fakestory-private');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(join(dir, 'notion-blocks.tmp'), JSON.stringify({ pageId, blocks }, null, 2), { mode: 0o600 });
  await rename(join(dir, 'notion-blocks.tmp'), join(dir, 'notion-blocks.json'));
  console.log('Saved a private local block snapshot. Block counts:', counts);
  console.log('This file is not used by the app or deployment. Never commit or share it.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Notion inspection failed.');
  process.exitCode = 1;
}
