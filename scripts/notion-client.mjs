const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Deliberately sequential: stay below Notion's average rate limit.
export function createNotionClient({ token, fetchImpl = fetch, sleep = delay }) {
  if (!token) throw new Error('NOTION_API_TOKEN is required.');
  async function get(path) {
    for (let attempt = 0; attempt < 4; attempt++) {
      await sleep(350);
      const response = await fetchImpl(`https://api.notion.com/v1/${path}`, {
        headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' }
      });
      if (response.status === 429 && attempt < 3) {
        const seconds = Number(response.headers.get('retry-after'));
        await sleep(Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 60) * 1000 : 1000 * 2 ** attempt);
        continue;
      }
      if (!response.ok) throw new Error(`Notion request failed (HTTP ${response.status}). Check integration access and capabilities.`);
      return response.json();
    }
    throw new Error('Notion rate limit retry budget exhausted.');
  }
  async function children(id) {
    let cursor = null;
    const all = [];
    do {
      const query = new URLSearchParams({ page_size: '100' });
      if (cursor) query.set('start_cursor', cursor);
      const page = await get(`blocks/${encodeURIComponent(id)}/children?${query}`);
      if (!Array.isArray(page.results)) throw new Error('Unexpected response: results missing.');
      all.push(...page.results);
      if (page.has_more && !page.next_cursor) throw new Error('Unexpected response: pagination cursor missing.');
      cursor = page.has_more ? page.next_cursor : null;
    } while (cursor);
    return all;
  }
  async function tree(id, ancestors = new Set()) {
    if (ancestors.has(id)) throw new Error('Cyclic block tree detected.');
    const next = new Set(ancestors); next.add(id);
    const blocks = await children(id);
    for (const block of blocks) if (block.has_children) block.children = await tree(block.id, next);
    return blocks;
  }
  return { tree };
}
