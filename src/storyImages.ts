/**
 * The story's images, from content/images/ (downloaded by the import).
 *
 * Bundled at build time: each file gets a fingerprinted URL, so browsers can
 * cache it for good and a changed image gets a new URL.
 */
const files = import.meta.glob<string>('/content/images/*', { eager: true, query: '?url', import: 'default' });

/** The URL of an image block's local file, e.g. 'images/abc.png', or undefined if it's missing. */
export function storyImageUrl(path: string): string | undefined {
  return files[`/content/${path}`];
}
