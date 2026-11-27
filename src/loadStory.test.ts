import { describe, expect, it } from 'vitest';

import { fixture } from './fixture';
import { currentStory } from './loadStory';

describe('loading the story', () => {
  it('falls back to the fixture until a story has been imported', () => {
    // The repository's tests run without content/story.json.
    expect(currentStory()).toBe(fixture);
  });
});
