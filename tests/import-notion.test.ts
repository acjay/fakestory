import { describe, expect, it } from 'vitest';

import { createNotionClient } from '../scripts/import-notion.ts';

const noDelay = async () => {};

const json = (data: unknown) => new Response(JSON.stringify(data));

describe('Notion client', () => {
  it('paginates and fetches nested children in order', async () => {
    const calls: string[] = [];

    // The root has two pages of children; its first child has one nested child.
    const fetchImpl = async (input: string | URL | Request) => {
      const url = new URL(String(input));
      calls.push(url.toString());

      if (url.pathname.endsWith('/root/children')) {
        return url.searchParams.has('start_cursor')
          ? json({ results: [{ id: 'last', type: 'paragraph', has_children: false }], has_more: false })
          : json({ results: [{ id: 'col', type: 'column', has_children: true }], has_more: true, next_cursor: 'more' });
      }

      return json({ results: [{ id: 'nested', type: 'paragraph', has_children: false }], has_more: false });
    };

    const client = createNotionClient({ token: 'fake', fetchImpl, sleep: noDelay });
    const blocks = await client.tree('root');

    expect(blocks.map((block) => block.id)).toEqual(['col', 'last']);
    expect(blocks[0].children?.[0].id).toBe('nested');
    expect(calls).toHaveLength(3);
  });

  it('retries rate limits and fails closed on access errors', async () => {
    let requests = 0;

    // First a 429, then a 403.
    const fetchImpl = async () => {
      requests++;
      return requests === 1
        ? new Response('', { status: 429, headers: { 'retry-after': '1' } })
        : new Response('', { status: 403 });
    };

    const client = createNotionClient({ token: 'fake', fetchImpl, sleep: noDelay });

    await expect(client.tree('root')).rejects.toThrow(/HTTP 403/);
    expect(requests).toBe(2);
  });

  it('rejects a response that claims more results but has no cursor', async () => {
    const fetchImpl = async () => json({ results: [], has_more: true });
    const client = createNotionClient({ token: 'fake', fetchImpl, sleep: noDelay });

    await expect(client.tree('root')).rejects.toThrow(/cursor missing/);
  });

  it("lists a block's comments across pages, filtered by block", async () => {
    const calls: URL[] = [];

    const fetchImpl = async (input: string | URL | Request) => {
      const url = new URL(String(input));
      calls.push(url);

      return url.searchParams.has('start_cursor')
        ? json({ results: [{ discussion_id: 'b' }], has_more: false })
        : json({ results: [{ discussion_id: 'a' }], has_more: true, next_cursor: 'next' });
    };

    const client = createNotionClient({ token: 'fake', fetchImpl, sleep: noDelay });
    const comments = await client.comments('block-1');

    expect(comments.map((comment) => comment.discussion_id)).toEqual(['a', 'b']);
    expect(calls.map((url) => url.pathname)).toEqual(['/v1/comments', '/v1/comments']);
    expect(calls.every((url) => url.searchParams.get('block_id') === 'block-1')).toBe(true);
  });

  it('reports the running total of blocks fetched', async () => {
    const fetchImpl = async (input: string | URL | Request) =>
      new URL(String(input)).pathname.endsWith('/root/children')
        ? json({
            results: [
              { id: 'a', type: 'toggle', has_children: true },
              { id: 'b', type: 'paragraph', has_children: false },
            ],
            has_more: false,
          })
        : json({ results: [{ id: 'a1', type: 'paragraph', has_children: false }], has_more: false });

    const progress: number[] = [];
    const client = createNotionClient({ token: 'fake', fetchImpl, sleep: noDelay });
    await client.tree('root', (count) => progress.push(count));

    expect(progress).toEqual([2, 3]);
  });
});
