/**
 * The published form of the story: what gets committed to content/story.json.
 *
 * The import fetches blocks exactly as Notion's API returns them, which
 * includes bookkeeping that the reader never uses and that changes on every
 * edit (edit times, editor IDs, parent pointers). Committing that would turn
 * every import into a noisy diff. So the snapshot keeps only what the reader
 * renders: each block's ID, type, children and type-specific content.
 *
 * It also removes signed download links for files uploaded to Notion. They
 * expire within the hour, so in the repository they'd be dead almost at once,
 * and they change on every import. Images will be stored properly in
 * subtask 06.
 */

import type { Block, Story } from '../src/model.ts';

/** Fields every Notion block carries that the reader never uses. */
const BOOKKEEPING = new Set([
  'object',
  'parent',
  'created_time',
  'created_by',
  'last_edited_time',
  'last_edited_by',
  'in_trash',
  'archived',
  'request_id',
]);

export function publishedStory(story: Story): Story {
  return { ...story, blocks: story.blocks.map(publishedBlock) };
}

function publishedBlock(block: Block): Block {
  const published: Block = { id: block.id, type: block.type };

  for (const [key, value] of Object.entries(block)) {
    if (key === 'id' || key === 'type' || BOOKKEEPING.has(key)) {
      continue;
    }

    published[key] = key === 'children' ? (value as Block[]).map(publishedBlock) : withoutSignedLinks(value);
  }

  return published;
}

/**
 * Remove expiring links to Notion-hosted files, anywhere in a value. Notion
 * marks them with an `expiry_time` next to the `url`; links to files hosted
 * elsewhere have no expiry and are kept.
 */
function withoutSignedLinks(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutSignedLinks);
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const entries = Object.entries(value);
  const isSignedLink = entries.some(([key]) => key === 'expiry_time');

  return Object.fromEntries(
    entries
      .filter(([key]) => !(isSignedLink && (key === 'url' || key === 'expiry_time')))
      .map(([key, inner]) => [key, withoutSignedLinks(inner)]),
  );
}

/** The snapshot as committed: stable, readable JSON with a trailing newline. */
export function serializeStory(story: Story): string {
  return `${JSON.stringify(publishedStory(story), null, 2)}\n`;
}
