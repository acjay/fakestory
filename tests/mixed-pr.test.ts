import { describe, expect, it } from 'vitest';

import { classifyFiles, COMMENT_MARKER, commentBody } from '../scripts/mixed-pr.ts';

describe('classifying a pull request’s files', () => {
  it('separates story content from everything else', () => {
    const changes = classifyFiles([
      { filename: 'content/story.json' },
      { filename: 'content/images/a1.png' },
      { filename: 'src/BlockView.tsx' },
      { filename: 'docs/publishing.md' },
    ]);

    expect(changes).toEqual({
      content: ['content/story.json', 'content/images/a1.png'],
      code: ['src/BlockView.tsx', 'docs/publishing.md'],
    });
  });

  it('counts a file moved into or out of content/ on both sides', () => {
    const changes = classifyFiles([{ filename: 'content/notes.md', previous_filename: 'notes.md' }]);

    expect(changes).toEqual({ content: ['content/notes.md'], code: ['content/notes.md'] });
  });

  it('doesn’t mistake similar names for content', () => {
    expect(classifyFiles([{ filename: 'src/content/x.ts' }, { filename: 'contents.md' }]).content).toEqual([]);
  });
});

describe('the warning comment', () => {
  it('warns about a mixed pull request, listing both sides', () => {
    const body = commentBody({ content: ['content/story.json'], code: ['src/a.ts', 'src/b.ts'] });

    expect(body.startsWith(COMMENT_MARKER)).toBe(true);
    expect(body).toContain('changes the story and code together');
    expect(body).toContain('Story content: 1 file');
    expect(body).toContain('Code and other files: 2 files');
    expect(body).toContain('- `src/b.ts`');
  });

  it('shortens long lists', () => {
    const code = Array.from({ length: 13 }, (_, index) => `src/file${index}.ts`);
    const body = commentBody({ content: ['content/story.json'], code });

    expect(body).toContain('- `src/file9.ts`');
    expect(body).not.toContain('src/file10.ts');
    expect(body).toContain('…and 3 more');
  });

  it('says so once a pull request is no longer mixed', () => {
    expect(commentBody({ content: ['content/story.json'], code: [] })).toContain('now changes only the story');
    expect(commentBody({ content: [], code: ['src/a.ts'] })).toContain('now changes only code');
  });
});
