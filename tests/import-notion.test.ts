import { describe, expect, it } from 'vitest';

import { createNotionClient, incompleteSnapshotProblems } from '../scripts/import-notion.ts';

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

  it('retries server errors and dropped connections, then succeeds', async () => {
    const outcomes = ['503', 'network', '502', 'ok'];
    let requests = 0;

    const fetchImpl = async () => {
      const outcome = outcomes[requests++];
      if (outcome === 'network') throw new TypeError('fetch failed');
      if (outcome === 'ok')
        return json({ results: [{ id: 'a', type: 'paragraph', has_children: false }], has_more: false });
      return new Response('', { status: Number(outcome) });
    };

    const client = createNotionClient({ token: 'fake', fetchImpl, sleep: noDelay });

    expect((await client.tree('root')).map((block) => block.id)).toEqual(['a']);
    expect(requests).toBe(4);
  });

  it('gives up on persistent server errors after five attempts', async () => {
    let requests = 0;
    const fetchImpl = async () => {
      requests++;
      return new Response('', { status: 503 });
    };

    const client = createNotionClient({ token: 'fake', fetchImpl, sleep: noDelay });

    await expect(client.tree('root')).rejects.toThrow(/HTTP 503\) after 5 attempts/);
    expect(requests).toBe(5);
  });

  it('gives up on persistent network failures after five attempts', async () => {
    let requests = 0;
    const fetchImpl = async () => {
      requests++;
      throw new TypeError('fetch failed');
    };

    const client = createNotionClient({ token: 'fake', fetchImpl, sleep: noDelay });

    await expect(client.tree('root')).rejects.toThrow(/Could not reach Notion after 5 attempts/);
    expect(requests).toBe(5);
  });

  it('does not retry access errors', async () => {
    let requests = 0;
    const fetchImpl = async () => {
      requests++;
      return new Response('', { status: 404 });
    };

    const client = createNotionClient({ token: 'fake', fetchImpl, sleep: noDelay });

    await expect(client.tree('root')).rejects.toThrow(/HTTP 404\)\. Check integration access/);
    expect(requests).toBe(1);
  });
});

describe('incompleteSnapshotProblems', () => {
  const complete = { truncated: false, unknown_block_ids: [] };

  it('finds nothing wrong with a complete import', () => {
    expect(incompleteSnapshotProblems(complete, [])).toEqual([]);
  });

  it('flags truncated Markdown, omitted blocks and unplaced footnotes', () => {
    const problems = incompleteSnapshotProblems({ truncated: true, unknown_block_ids: ['b1', 'b2'] }, [
      'Footnote f1: no anchored text found in the page Markdown.',
    ]);

    expect(problems).toEqual([
      'Notion truncated the page Markdown, so footnotes near the end may be missing.',
      'The page Markdown left out 2 blocks, so footnotes in them may be missing: b1, b2',
      'Footnote f1: no anchored text found in the page Markdown.',
    ]);
  });
});
