/**
 * Warns when a pull request changes both the story and anything else.
 *
 * Merging a pull request that touches content/ publishes the story as it
 * stands on that branch. When the same pull request also changes code, it's
 * easy to publish a test import by accident while merging a code change (or
 * the other way round). This never blocks a merge: it labels the pull request
 * and keeps one comment on it up to date. See docs/publishing.md.
 *
 * Run by .github/workflows/mixed-pr.yml, with GITHUB_TOKEN, GITHUB_REPOSITORY
 * and PR_NUMBER set.
 */

import { createGitHub } from './github.ts';

export const LABEL = 'content + code';
const LABEL_COLOR = 'd4a72c';
const LABEL_DESCRIPTION = 'Changes the story and code together: merging publishes both';

/** Hidden marker that identifies our comment, so it's updated rather than repeated. */
export const COMMENT_MARKER = '<!-- mixed-pr-warning -->';

export type ChangedFile = { filename: string; previous_filename?: string };

/** Which changed files are story content, and which are everything else. */
export function classifyFiles(files: ChangedFile[]): { content: string[]; code: string[] } {
  const isContent = (path: string) => path.startsWith('content/');
  const content: string[] = [];
  const code: string[] = [];

  for (const file of files) {
    // A file moved into or out of content/ counts on both sides it touched.
    const paths = [file.filename, file.previous_filename].filter((path): path is string => Boolean(path));
    if (paths.some(isContent)) {
      content.push(file.filename);
    }
    if (paths.some((path) => !isContent(path))) {
      code.push(file.filename);
    }
  }

  return { content, code };
}

/** The comment for a pull request, given what it changes. */
export function commentBody({ content, code }: { content: string[]; code: string[] }): string {
  if (content.length === 0 || code.length === 0) {
    return [
      COMMENT_MARKER,
      '✅ **No longer mixed.** This pull request now changes only ' +
        (content.length > 0 ? 'the story.' : 'code, not the story.'),
    ].join('\n');
  }

  const list = (paths: string[]) => {
    const shown = paths.slice(0, 10).map((path) => `- \`${path}\``);
    if (paths.length > 10) {
      shown.push(`- …and ${paths.length - 10} more`);
    }
    return shown.join('\n');
  };

  return [
    COMMENT_MARKER,
    '⚠️ **This pull request changes the story and code together.** ' +
      'Merging it publishes the story as it stands on this branch, along with the code.',
    '',
    'If that’s intended, carry on. Otherwise, keep imports on a `content/…` branch and code on its own branch ' +
      '(see `docs/publishing.md`).',
    '',
    `<details><summary>Story content: ${plural(content.length, 'file')}</summary>\n\n${list(content)}\n\n</details>`,
    '',
    `<details><summary>Code and other files: ${plural(code.length, 'file')}</summary>\n\n${list(code)}\n\n</details>`,
  ].join('\n');
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const pullNumber = process.env.PR_NUMBER;
  if (!token || !repository || !pullNumber) {
    throw new Error('Set GITHUB_TOKEN, GITHUB_REPOSITORY and PR_NUMBER.');
  }

  const github = createGitHub(token, repository);

  // 1. What does the pull request change?
  const files = await github.all<ChangedFile>(`/pulls/${pullNumber}/files`);
  const changes = classifyFiles(files);
  const mixed = changes.content.length > 0 && changes.code.length > 0;
  console.log(`Story files: ${changes.content.length}. Other files: ${changes.code.length}.`);

  // 2. Find our earlier comment, if any.
  type Comment = { id: number; body?: string };
  const comments = await github.all<Comment>(`/issues/${pullNumber}/comments`);
  const existing = comments.find((comment) => comment.body?.includes(COMMENT_MARKER));

  if (mixed) {
    // A GitHub Actions warning shows on the run's summary, too.
    console.log(`::warning title=Story and code together::${LABEL_DESCRIPTION}.`);

    // 3. Label it.
    await github.addLabel(Number(pullNumber), { name: LABEL, color: LABEL_COLOR, description: LABEL_DESCRIPTION });
  } else {
    // 3. Not (or no longer) mixed: remove the label.
    await github.removeLabel(Number(pullNumber), LABEL);
  }

  // 4. Keep one comment up to date. Only say "no longer mixed" if we warned before.
  const body = commentBody(changes);
  if (existing) {
    if (existing.body !== body) {
      await github.call('PATCH', `/issues/comments/${existing.id}`, { body });
    }
  } else if (mixed) {
    await github.call('POST', `/issues/${pullNumber}/comments`, { body });
  }
}

if (import.meta.main) {
  await main();
}
