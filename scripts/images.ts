/**
 * Images: copied from Notion into the repository at import time.
 *
 * Files uploaded to Notion come with download links that expire within the
 * hour, and the site's security policy only allows images from the site
 * itself. So the import downloads every image, uploaded or external, and the
 * snapshot points at the local copy instead:
 *
 *   image: { type: 'local', path: 'images/<block id>.png', caption: [...] }
 *
 * Files are named after their block, so an unchanged image keeps its name
 * (and its bytes) across imports. The reader turns the path into a URL at
 * build time (src/storyImages.ts).
 */

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Block, RichText } from '../src/model.ts';
import { normalizeId } from './footnotes.ts';

/** File extensions for the image types we accept, by Content-Type. */
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

/** An image block as Notion returns it. */
type NotionImage = {
  type: 'file' | 'external' | string;
  file?: { url?: string };
  external?: { url?: string };
  caption?: RichText[];
};

export type LocalImage = { type: 'local'; path: string; caption: RichText[] };

export type ImageFile = { path: string; bytes: Uint8Array };

export type LocalizedImages = {
  /** A copy of the blocks, with every image pointing at its local file. */
  blocks: Block[];

  /** The files to write under content/, once the import is known to be complete. */
  files: ImageFile[];

  /** Images that couldn't be downloaded, by block ID. These make the import incomplete. */
  problems: string[];

  /** Images without a caption, by block ID. Their caption is their only text alternative. */
  uncaptioned: string[];
};

/** Download every image in the story and point its block at the local copy. */
export async function localizeImages(
  blocks: Block[],
  fetchImpl: typeof fetch = fetch,
  onProgress?: (done: number, total: number) => void,
): Promise<LocalizedImages> {
  const tree = structuredClone(blocks);
  const images = imageBlocks(tree);
  const result: LocalizedImages = { blocks: tree, files: [], problems: [], uncaptioned: [] };

  for (const [index, block] of images.entries()) {
    onProgress?.(index, images.length);
    const image = block.image as NotionImage;
    const id = normalizeId(block.id);

    if (!image.caption?.length) {
      result.uncaptioned.push(id);
    }

    const url = image.type === 'file' ? image.file?.url : image.external?.url;
    if (!url) {
      result.problems.push(`Image ${id}: no file to download.`);
      continue;
    }

    try {
      const { bytes, extension } = await download(url, fetchImpl);
      const path = `images/${id}.${extension}`;

      result.files.push({ path, bytes });
      block.image = { type: 'local', path, caption: image.caption ?? [] } satisfies LocalImage;
    } catch (error) {
      result.problems.push(`Image ${id}: ${error instanceof Error ? error.message : 'download failed.'}`);
    }
  }

  onProgress?.(images.length, images.length);
  return result;
}

/** Fetch an image, retrying briefly, and check that it really is one. */
async function download(url: string, fetchImpl: typeof fetch): Promise<{ bytes: Uint8Array; extension: string }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetchImpl(url);
      if (!response.ok) {
        throw new Error(`download failed (HTTP ${response.status}).`);
      }

      const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      const extension = EXTENSIONS[type];
      if (!extension) {
        throw new Error(`not a supported image type (${type || 'unknown'}).`);
      }

      return { bytes: new Uint8Array(await response.arrayBuffer()), extension };
    } catch (error) {
      lastError = error;
      // Don't retry an answer that won't change.
      if (error instanceof Error && error.message.startsWith('not a supported')) {
        break;
      }
    }
  }

  throw lastError;
}

function imageBlocks(blocks: Block[], found: Block[] = []): Block[] {
  for (const block of blocks) {
    if (block.type === 'image') {
      found.push(block);
    }
    if (block.children) {
      imageBlocks(block.children, found);
    }
  }
  return found;
}

/**
 * Write the images under `contentDir`, and remove any image files there
 * that the story no longer uses.
 */
export async function writeImages(contentDir: string, files: ImageFile[]): Promise<void> {
  const imagesDir = join(contentDir, 'images');
  const keep = new Set(files.map((file) => file.path.replace(/^images\//, '')));

  await mkdir(imagesDir, { recursive: true });
  await Promise.all(files.map((file) => writeFile(join(contentDir, file.path), file.bytes)));

  let existing: string[] = [];
  try {
    existing = await readdir(imagesDir);
  } catch {
    // No images directory yet.
  }
  await Promise.all(existing.filter((name) => !keep.has(name)).map((name) => rm(join(imagesDir, name))));
}
