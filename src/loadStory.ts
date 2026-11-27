import { fixture } from './fixture';
import type { Story } from './model';

/**
 * The published story, if there is one: content/story.json, written by
 * `npm run import:notion` and committed to the repository. It's bundled at
 * build time, so every build (local, preview, production) shows exactly the
 * committed story. Until the first import, there's no file, and the reader
 * shows the invented fixture instead.
 */
const published = import.meta.glob<Story>('/content/story.json', { eager: true, import: 'default' });

export function currentStory(): Story {
  return published['/content/story.json'] ?? fixture;
}

/** Kept async so the reader could load content lazily later without changing callers. */
export async function loadStory(): Promise<Story> {
  return currentStory();
}
