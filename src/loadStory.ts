import { fixture } from './fixture';
import type { Story } from './model';

/**
 * Which story to render: the invented fixture, or (local development only)
 * the private snapshot written by `npm run import:notion`.
 *
 * `import.meta.env.DEV` is false in production builds, so the bundler drops the
 * whole local branch, including the URL. scripts/check-build.ts verifies it.
 */
export async function loadStory(): Promise<Story> {
  if (import.meta.env.DEV && import.meta.env.VITE_LOCAL_STORY === '1') {
    const response = await fetch('/__local/story.json');
    if (!response.ok) {
      throw new Error(await response.text());
    }

    return (await response.json()) as Story;
  }

  return fixture;
}
