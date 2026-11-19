/**
 * Read-only import of the real story from Notion.
 *
 * Fetches the page's complete block tree, plus the page Markdown and comments
 * needed to find footnotes, and writes the result as a private local story
 * file in the same shape the reader renders (see `src/model.ts`). It prints
 * counts and problems, never story text. The app does not load this file: it
 * renders `src/fixture.ts`.
 *
 *   NOTION_API_TOKEN=... NOTION_PAGE_ID=... npm run import:notion
 *
 * The integration needs the "Read content" and "Read comments" capabilities,
 * and must be connected to the page.
 *
 * Reading order: `importNotion` (the whole sequence), then its helpers, then
 * the Notion API client. The script is started at the very bottom.
 */

import { mkdir, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { Block, RichText, Story } from '../src/model.ts';
import { anchorFootnotes, findAnchors, selectFootnotes, type NotionComment } from './footnotes.ts';

// Outside the repository and Vite's web root, so draft content can't be
// committed or end up in build output.
const SNAPSHOT_DIR = join(homedir(), '.fakestory-private');
const STORY_FILE = join(SNAPSHOT_DIR, 'story.json');

// A page ID, with or without dashes.
const PAGE_ID_PATTERN = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

async function importNotion() {
  const pageId = process.env.NOTION_PAGE_ID;
  if (!pageId || !PAGE_ID_PATTERN.test(pageId)) {
    throw new Error('Set NOTION_PAGE_ID to a page UUID.');
  }

  const client = createNotionClient({ token: process.env.NOTION_API_TOKEN });

  // 1. The content itself: the title and the full block tree.
  const title = await client.pageTitle(pageId);
  const blocks = await client.tree(pageId);

  // 2. Footnotes: anchors come from the page Markdown, note text from the
  //    comments on each anchored block.
  const markdown = await client.pageMarkdown(pageId);
  const anchors = findAnchors(markdown.markdown);

  const comments: NotionComment[] = [];
  for (const blockId of new Set(anchors.map((anchor) => anchor.blockId))) {
    comments.push(...(await client.comments(blockId)));
  }

  const footnotes = anchorFootnotes(blocks, anchors, selectFootnotes(comments));

  // 3. Save, then report.
  const story: Story = { title, blocks: footnotes.blocks, glossary: {}, footnotes: footnotes.footnotes };
  await writeStory(story);

  // Counts and IDs only, never story text, so the output is safe to share.
  console.log('Saved a private local story snapshot.');
  console.log('Block counts:', countBlockTypes(blocks));
  console.log(`Commented spans: ${anchors.length}. Footnotes anchored: ${Object.keys(story.footnotes).length}.`);

  if (markdown.truncated) {
    console.warn('Warning: Notion truncated the page Markdown, so footnotes near the end may be missing.');
  }
  if (markdown.unknown_block_ids.length > 0) {
    console.warn(`Warning: the page Markdown left out ${markdown.unknown_block_ids.length} block(s).`);
  }
  for (const problem of footnotes.problems) {
    console.warn(`Problem: ${problem}`);
  }

  console.log('This file is not used by the app or deployment. Never commit or share it.');
}

/**
 * Write to a temporary file, then rename it into place. The rename is atomic,
 * so a failed or interrupted run never leaves a half-written snapshot, and the
 * last good snapshot survives until a new one is complete.
 */
async function writeStory(story: Story) {
  const tempFile = `${STORY_FILE}.tmp`;

  // Readable by the current user only.
  await mkdir(SNAPSHOT_DIR, { recursive: true, mode: 0o700 });
  await writeFile(tempFile, JSON.stringify(story, null, 2), { mode: 0o600 });

  await rename(tempFile, STORY_FILE);
}

function countBlockTypes(blocks: Block[], counts: Record<string, number> = {}) {
  for (const block of blocks) {
    counts[block.type] = (counts[block.type] ?? 0) + 1;

    if (block.children) {
      countBlockTypes(block.children, counts);
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Notion API client
//
// A minimal, read-only client for the few endpoints the import needs.
// Requests are made one at a time to stay under Notion's rate limit (an
// average of ~3 requests per second).
// ---------------------------------------------------------------------------

const NOTION_API = 'https://api.notion.com/v1';

// The page Markdown endpoint needs a recent API version.
const NOTION_VERSION = '2025-09-03';

/** Pause before every request, to average just under 3 requests/second. */
const REQUEST_SPACING_MS = 350;

/** One initial attempt plus up to three retries after a 429. */
const MAX_ATTEMPTS = 4;

/** Never honor a `Retry-After` longer than this. */
const MAX_RETRY_AFTER_SECONDS = 60;

/** The API's maximum page size for paginated lists. */
const PAGE_SIZE = '100';

/**
 * The parts of a Notion block we rely on. The rest of the API response is
 * kept as-is, so the snapshot stays a faithful copy of what Notion returned.
 */
export type NotionBlock = Block & {
  has_children: boolean;
  children?: NotionBlock[];
};

/** One page of a paginated list endpoint. */
type ListPage<T> = {
  results: T[];
  has_more: boolean;
  next_cursor?: string | null;
};

type PageMarkdown = {
  markdown: string;
  truncated: boolean;
  unknown_block_ids: string[];
};

type PageProperties = {
  properties: Record<string, { type: string; title?: RichText[] }>;
};

export type NotionClientOptions = {
  token: string | undefined;

  // Injectable so tests can run without the network or real delays.
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Exported for tests.
export function createNotionClient({ token, fetchImpl = fetch, sleep = delay }: NotionClientOptions) {
  if (!token) {
    throw new Error('NOTION_API_TOKEN is required.');
  }

  /** GET an API path, retrying only on rate limits (HTTP 429). */
  async function get<T>(path: string): Promise<T> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await sleep(REQUEST_SPACING_MS);

      const response = await fetchImpl(`${NOTION_API}/${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': NOTION_VERSION,
        },
      });

      const isLastAttempt = attempt === MAX_ATTEMPTS - 1;
      if (response.status === 429 && !isLastAttempt) {
        await sleep(retryDelayMs(response, attempt));
        continue;
      }

      // Deliberately vague: error bodies can echo request details.
      if (!response.ok) {
        throw new Error(`Notion request failed (HTTP ${response.status}). Check integration access and capabilities.`);
      }

      return (await response.json()) as T;
    }

    throw new Error('Notion rate limit retry budget exhausted.');
  }

  /** GET every item of a paginated list, following cursors. */
  async function getAll<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
    const all: T[] = [];
    let cursor: string | null = null;

    do {
      const query = new URLSearchParams({ ...params, page_size: PAGE_SIZE });
      if (cursor) {
        query.set('start_cursor', cursor);
      }

      const page = await get<ListPage<T>>(`${path}?${query}`);

      // Fail loudly on a malformed response, rather than return a partial list.
      if (!Array.isArray(page.results)) {
        throw new Error('Unexpected response: results missing.');
      }
      if (page.has_more && !page.next_cursor) {
        throw new Error('Unexpected response: pagination cursor missing.');
      }

      all.push(...page.results);
      cursor = page.has_more ? (page.next_cursor ?? null) : null;
    } while (cursor);

    return all;
  }

  /**
   * Fetch a block's full subtree, depth first, attaching each block's children
   * as a `children` array (the API itself only returns one level at a time).
   */
  async function tree(blockId: string, ancestors: ReadonlySet<string> = new Set()): Promise<NotionBlock[]> {
    // Guards against synced blocks or links that loop back on themselves.
    if (ancestors.has(blockId)) {
      throw new Error('Cyclic block tree detected.');
    }
    const path = new Set(ancestors).add(blockId);

    const blocks = await getAll<NotionBlock>(`blocks/${encodeURIComponent(blockId)}/children`);
    for (const block of blocks) {
      if (block.has_children) {
        block.children = await tree(block.id, path);
      }
    }

    return blocks;
  }

  /** The page's title, as plain text. */
  async function pageTitle(pageId: string): Promise<string> {
    const page = await get<PageProperties>(`pages/${encodeURIComponent(pageId)}`);
    const title = Object.values(page.properties).find((property) => property.type === 'title')?.title ?? [];

    return title.map((run) => run.plain_text).join('');
  }

  /** The whole page as Notion-flavored Markdown, which includes comment anchors. */
  async function pageMarkdown(pageId: string): Promise<PageMarkdown> {
    return get<PageMarkdown>(`pages/${encodeURIComponent(pageId)}/markdown`);
  }

  /** The open (unresolved) comments on a block. */
  async function comments(blockId: string): Promise<NotionComment[]> {
    return getAll<NotionComment>('comments', { block_id: blockId });
  }

  return { tree, pageTitle, pageMarkdown, comments };
}

/** Prefer the server's `Retry-After`; otherwise back off exponentially. */
function retryDelayMs(response: Response, attempt: number): number {
  const seconds = Number(response.headers.get('retry-after'));

  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds, MAX_RETRY_AFTER_SECONDS) * 1000;
  }

  return 1000 * 2 ** attempt;
}

// ---------------------------------------------------------------------------
// Run, but only when executed directly (not when imported by tests).
// ---------------------------------------------------------------------------

if (import.meta.main) {
  try {
    await importNotion();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Notion import failed.');
    process.exitCode = 1;
  }
}
