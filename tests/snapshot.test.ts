import { describe, expect, it } from 'vitest';

import { isSignedUrl, publishedStory, serializeStory } from '../scripts/snapshot.ts';
import type { Block, Story } from '../src/model.ts';

/** A block as Notion's API returns it, with all its bookkeeping. */
const fromNotion = (id: string, extra: Record<string, unknown> = {}): Block => ({
  object: 'block',
  id,
  type: 'paragraph',
  parent: { type: 'page_id', page_id: 'page' },
  created_time: '2024-01-01T00:00:00.000Z',
  created_by: { object: 'user', id: 'someone' },
  last_edited_time: '2026-11-25T12:00:00.000Z',
  last_edited_by: { object: 'user', id: 'someone' },
  has_children: false,
  in_trash: false,
  archived: false,
  paragraph: { rich_text: [{ type: 'text', plain_text: 'Hello', href: null }], color: 'default' },
  ...extra,
});

const story = (blocks: Block[]): Story => ({ title: 'T', blocks, glossary: {}, footnotes: {} });

describe('published snapshot', () => {
  it('keeps only what the reader renders', () => {
    const [block] = publishedStory(story([fromNotion('a')])).blocks;

    expect(block).toEqual({
      id: 'a',
      type: 'paragraph',
      has_children: false,
      paragraph: { rich_text: [{ type: 'text', plain_text: 'Hello', href: null }], color: 'default' },
    });
  });

  it('trims nested children too', () => {
    const parent = fromNotion('parent', { has_children: true, children: [fromNotion('child')] });
    const [published] = publishedStory(story([parent])).blocks;

    expect(published.children?.[0]).not.toHaveProperty('last_edited_time');
    expect(published.children?.[0].id).toBe('child');
  });

  it('is identical when only Notion bookkeeping changed, so re-imports make no diff', () => {
    const before = serializeStory(story([fromNotion('a')]));
    const after = serializeStory(story([fromNotion('a', { last_edited_time: '2026-12-01T00:00:00.000Z' })]));

    expect(after).toBe(before);
  });

  it('drops expiring links to files uploaded to Notion, but keeps other links', () => {
    const uploaded = fromNotion('img', {
      type: 'image',
      image: {
        type: 'file',
        file: {
          url: 'https://prod-files-secure.s3.amazonaws.com/x?X-Amz-Signature=abc',
          expiry_time: '2026-11-25T13:00:00Z',
        },
        caption: [],
      },
    });
    const external = fromNotion('ext', {
      type: 'image',
      image: { type: 'external', external: { url: 'https://example.com/a.png' }, caption: [] },
    });

    const [published, kept] = publishedStory(story([uploaded, external])).blocks;

    expect(published.image).toEqual({ type: 'file', file: {}, caption: [] });
    expect(kept.image).toEqual({ type: 'external', external: { url: 'https://example.com/a.png' }, caption: [] });
  });

  it('drops signed links to uploaded files that Notion doesn’t mark as expiring, e.g. embedded HTML', () => {
    const uploadedEmbed = fromNotion('emb', {
      type: 'embed',
      embed: {
        url: 'https://prod-files-secure.s3.us-west-2.amazonaws.com/a/b/demo.html?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=X&X-Amz-Security-Token=T&X-Amz-Signature=S',
        caption: [],
      },
    });
    const ourDemo = fromNotion('ours', {
      type: 'embed',
      embed: { url: 'https://fakestory.alanjay1.workers.dev/demos/number-line/?fifths=5', caption: [] },
    });

    const [dropped, kept] = publishedStory(story([uploadedEmbed, ourDemo])).blocks;

    expect(dropped.embed).toEqual({ caption: [] });
    expect(kept.embed).toEqual({
      url: 'https://fakestory.alanjay1.workers.dev/demos/number-line/?fifths=5',
      caption: [],
    });
  });

  it('recognizes signed links, and nothing else', () => {
    expect(isSignedUrl('https://bucket.s3.amazonaws.com/f.html?X-Amz-Signature=abc')).toBe(true);
    expect(isSignedUrl('https://codepen.io/acjay/embed/WNVQWKx?default-tab=result')).toBe(false);
    expect(isSignedUrl('not a url')).toBe(false);
    expect(isSignedUrl(undefined)).toBe(false);
  });

  it('keeps footnotes, title and glossary as they are', () => {
    const footnotes = { d1: [{ type: 'text' as const, plain_text: 'A note.' }] };
    const published = publishedStory({ title: 'Story', blocks: [], glossary: {}, footnotes });

    expect(published).toEqual({ title: 'Story', blocks: [], glossary: {}, footnotes });
  });

  it('serializes as readable JSON ending in a newline', () => {
    const text = serializeStory(story([]));

    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "title": "T"');
  });
});
