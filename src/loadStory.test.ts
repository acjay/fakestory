import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fixture } from './fixture';
import { currentStory } from './loadStory';

describe('loading the story', () => {
  it('shows the committed story, or the fixture before the first import', () => {
    const storyFile = join(import.meta.dirname, '..', 'content', 'story.json');
    const expected = existsSync(storyFile) ? JSON.parse(readFileSync(storyFile, 'utf8')) : fixture;

    expect(currentStory()).toEqual(expected);
  });
});
