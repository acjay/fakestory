/**
 * A minimal, read-only client for the Notion REST API.
 *
 * It only knows how to fetch a block tree: a page's children, their children,
 * and so on. Requests are made one at a time to stay under Notion's rate limit
 * (an average of ~3 requests per second).
 */

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

/** Pause before every request, to average just under 3 requests/second. */
const REQUEST_SPACING_MS = 350;

/** One initial attempt plus up to three retries after a 429. */
const MAX_ATTEMPTS = 4;

/** Never honor a `Retry-After` longer than this. */
const MAX_RETRY_AFTER_SECONDS = 60;

/** The API's maximum page size for block children. */
const PAGE_SIZE = '100';

/**
 * The parts of a Notion block we rely on. The rest of the API response is
 * kept as-is, so the snapshot stays a faithful copy of what Notion returned.
 */
export type NotionBlock = {
  id: string;
  type: string;
  has_children: boolean;
  children?: NotionBlock[];
  [field: string]: unknown;
};

type ChildrenPage = {
  results: NotionBlock[];
  has_more: boolean;
  next_cursor?: string | null;
};

export type NotionClientOptions = {
  token: string | undefined;

  // Injectable so tests can run without the network or real delays.
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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

  /** Fetch every direct child of a block, following pagination cursors. */
  async function children(blockId: string): Promise<NotionBlock[]> {
    const all: NotionBlock[] = [];
    let cursor: string | null = null;

    do {
      const query = new URLSearchParams({ page_size: PAGE_SIZE });
      if (cursor) {
        query.set('start_cursor', cursor);
      }

      const page = await get<ChildrenPage>(`blocks/${encodeURIComponent(blockId)}/children?${query}`);

      // Fail loudly on a malformed response, rather than return a partial tree.
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

    const blocks = await children(blockId);
    for (const block of blocks) {
      if (block.has_children) {
        block.children = await tree(block.id, path);
      }
    }

    return blocks;
  }

  return { tree };
}

/** Prefer the server's `Retry-After`; otherwise back off exponentially. */
function retryDelayMs(response: Response, attempt: number): number {
  const seconds = Number(response.headers.get('retry-after'));

  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds, MAX_RETRY_AFTER_SECONDS) * 1000;
  }

  return 1000 * 2 ** attempt;
}
