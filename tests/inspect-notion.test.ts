import { describe, expect, it } from 'vitest';

import { createNotionClient } from '../scripts/inspect-notion.ts';

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
});
