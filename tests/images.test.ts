import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { localizeImages, writeImages } from '../scripts/images.ts';
import type { Block } from '../src/model.ts';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

/** An image block as Notion returns it. */
const uploadedImage = (id: string, caption: string[] = []): Block => ({
  id,
  type: 'image',
  image: {
    type: 'file',
    file: { url: `https://files.example/${id}?signature=x`, expiry_time: '2026-11-27T05:00:00Z' },
    caption: caption.map((plain_text) => ({ type: 'text', plain_text })),
  },
});

/** A fake fetch that answers each URL with the given status and Content-Type. */
const fakeFetch =
  (answers: Record<string, { status?: number; type?: string }>, calls: string[] = []): typeof fetch =>
  async (input) => {
    const url = String(input);
    calls.push(url);
    const answer = answers[url] ?? { status: 404 };

    return new Response(PNG_BYTES, {
      status: answer.status ?? 200,
      headers: answer.type ? { 'content-type': answer.type } : {},
    });
  };

describe('localizing images', () => {
  it('downloads each image, including nested ones, and points its block at the local file', async () => {
    const nested: Block = { id: 'col', type: 'column', has_children: true, children: [uploadedImage('b-2')] };
    const external: Block = {
      id: 'c3',
      type: 'image',
      image: { type: 'external', external: { url: 'https://example.com/c.jpg' }, caption: [] },
    };
    const fetchImpl = fakeFetch({
      'https://files.example/a1?signature=x': { type: 'image/png' },
      'https://files.example/b-2?signature=x': { type: 'image/webp; charset=binary' },
      'https://example.com/c.jpg': { type: 'image/jpeg' },
    });

    const result = await localizeImages([uploadedImage('a1', ['A caption']), nested, external], fetchImpl);

    expect(result.problems).toEqual([]);
    expect(result.files.map((file) => file.path)).toEqual(['images/a1.png', 'images/b2.webp', 'images/c3.jpg']);
    expect(result.files[0].bytes).toEqual(PNG_BYTES);
    expect(result.blocks[0].image).toEqual({
      type: 'local',
      path: 'images/a1.png',
      caption: [{ type: 'text', plain_text: 'A caption' }],
    });
    expect(result.blocks[1].children?.[0].image).toMatchObject({ type: 'local', path: 'images/b2.webp' });
  });

  it('leaves the original blocks untouched', async () => {
    const blocks = [uploadedImage('a1')];
    await localizeImages(blocks, fakeFetch({ 'https://files.example/a1?signature=x': { type: 'image/png' } }));

    expect(blocks[0].image).toMatchObject({ type: 'file' });
  });

  it('lists images without a caption, since the caption is their only text alternative', async () => {
    const fetchImpl = fakeFetch({
      'https://files.example/a1?signature=x': { type: 'image/png' },
      'https://files.example/b2?signature=x': { type: 'image/png' },
    });
    const result = await localizeImages([uploadedImage('a1', ['Shown']), uploadedImage('b2')], fetchImpl);

    expect(result.uncaptioned).toEqual(['b2']);
  });

  it('reports failed downloads as problems, after retrying', async () => {
    const calls: string[] = [];
    const result = await localizeImages([uploadedImage('a1')], fakeFetch({}, calls));

    expect(result.problems).toEqual(['Image a1: download failed (HTTP 404).']);
    expect(result.files).toEqual([]);
    expect(calls).toHaveLength(3);
  });

  it('rejects files that aren’t a supported image type, without retrying', async () => {
    const calls: string[] = [];
    const fetchImpl = fakeFetch({ 'https://files.example/a1?signature=x': { type: 'text/html' } }, calls);
    const result = await localizeImages([uploadedImage('a1')], fetchImpl);

    expect(result.problems).toEqual(['Image a1: not a supported image type (text/html).']);
    expect(calls).toHaveLength(1);
  });

  it('reports an image with nothing to download', async () => {
    const empty: Block = { id: 'a1', type: 'image', image: { type: 'file', file: {}, caption: [] } };
    const result = await localizeImages([empty], fakeFetch({}));

    expect(result.problems).toEqual(['Image a1: no file to download.']);
  });
});

describe('writing images', () => {
  let contentDir: string | undefined;

  afterEach(async () => {
    if (contentDir) {
      await rm(contentDir, { recursive: true, force: true });
    }
  });

  it('writes the story’s images and removes ones it no longer uses', async () => {
    contentDir = await mkdtemp(join(tmpdir(), 'fakestory-images-'));
    await mkdir(join(contentDir, 'images'));
    await writeFile(join(contentDir, 'images', 'old.png'), 'stale');

    await writeImages(contentDir, [{ path: 'images/a1.png', bytes: PNG_BYTES }]);

    expect(await readdir(join(contentDir, 'images'))).toEqual(['a1.png']);
    expect(new Uint8Array(await readFile(join(contentDir, 'images', 'a1.png')))).toEqual(PNG_BYTES);
  });
});
