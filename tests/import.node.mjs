import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotionClient } from '../scripts/notion-client.mjs';

test('paginates and fetches nested children in order', async () => {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    const u = new URL(url);
    let data;
    if (u.pathname.endsWith('/root/children') && !u.searchParams.has('start_cursor')) data = { results: [{ id: 'col', type: 'column', has_children: true }], has_more: true, next_cursor: 'more' };
    else if (u.pathname.endsWith('/root/children')) data = { results: [{ id: 'last', type: 'paragraph', has_children: false }], has_more: false };
    else data = { results: [{ id: 'nested', type: 'paragraph', has_children: false }], has_more: false };
    return new Response(JSON.stringify(data));
  };
  const blocks = await createNotionClient({ token: 'fake', fetchImpl, sleep: async () => {} }).tree('root');
  assert.deepEqual(blocks.map(b => b.id), ['col', 'last']);
  assert.equal(blocks[0].children[0].id, 'nested');
  assert.equal(calls.length, 3);
});

test('retries rate limits and fails closed on access errors', async () => {
  let count = 0;
  const client = createNotionClient({ token: 'fake', sleep: async () => {}, fetchImpl: async () => ++count === 1 ? new Response('', { status: 429, headers: { 'retry-after': '1' } }) : new Response('', { status: 403 }) });
  await assert.rejects(client.tree('root'), /HTTP 403/);
  assert.equal(count, 2);
});

test('rejects missing pagination cursor', async () => {
  const client = createNotionClient({ token: 'fake', sleep: async () => {}, fetchImpl: async () => new Response(JSON.stringify({ results: [], has_more: true })) });
  await assert.rejects(client.tree('root'), /cursor missing/);
});
