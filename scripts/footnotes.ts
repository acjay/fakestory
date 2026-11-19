/**
 * Footnote import: turns Notion comments into footnotes anchored to exact text.
 *
 * Notion's block API doesn't say which words a comment is attached to, but the
 * page Markdown does, by wrapping them in a span:
 *
 *   As they say, <span discussion-urls="discussion://PAGE/BLOCK/DISCUSSION">“the map…”</span>
 *
 * So the import has three steps, run in this order:
 *
 *   1. `findAnchors`: find every commented span in the page Markdown.
 *   2. `selectFootnotes`: decide which discussions are footnotes, from their comments.
 *   3. `anchorFootnotes`: mark the anchored words in the block tree, splitting
 *      rich-text runs where an anchor starts or ends mid-run.
 *
 * The block tree stays the source of truth; Markdown is only used to locate
 * anchors. Anything that can't be matched is reported, never silently dropped.
 * Problems mention IDs only, never story text, so they're safe to print.
 *
 * Editorial rules (see docs/content-model.md):
 *   - Only an open discussion whose first comment starts with "Footnote: " is a footnote.
 *   - Replies, and comments without the prefix, are never published.
 *   - The prefix is removed from the rendered note.
 */

import type { Block, RichText } from '../src/model.ts';

export const FOOTNOTE_PREFIX = 'Footnote: ';

// ---------------------------------------------------------------------------
// 1. Find anchors in the page Markdown
// ---------------------------------------------------------------------------

/** A commented span found in the page Markdown. */
export type MarkdownAnchor = {
  /** The block containing the span (normalized ID). */
  blockId: string;

  /** Every discussion attached to the span (normalized IDs). */
  discussionIds: string[];

  /** The span's text, with Markdown syntax removed. */
  text: string;

  /**
   * How many times `text` appears earlier in the same paragraph. Used to pick
   * the right match when a phrase repeats within a block.
   */
  occurrence: number;
};

const SPAN_TAG = /<(\/?)span\b([^>]*)>/g;
const DISCUSSION_URLS_ATTRIBUTE = /\bdiscussion-urls="([^"]*)"/;

export function findAnchors(markdown: string): MarkdownAnchor[] {
  const anchors: MarkdownAnchor[] = [];

  // Spans can nest (e.g. a colored span inside a commented one), so track
  // open tags on a stack and pair each closing tag with its opener.
  const open: { attributes: string; tagStart: number; contentStart: number }[] = [];

  for (const match of markdown.matchAll(SPAN_TAG)) {
    const [tag, slash, attributes] = match;

    if (!slash) {
      open.push({ attributes, tagStart: match.index, contentStart: match.index + tag.length });
      continue;
    }

    const opener = open.pop();
    const urls = opener?.attributes.match(DISCUSSION_URLS_ATTRIBUTE)?.[1];
    if (!opener || !urls) {
      continue;
    }

    const discussions = urls.split(',').map(parseDiscussionUrl);
    const blockId = discussions.find((discussion) => discussion)?.blockId;
    if (!blockId) {
      continue;
    }

    const text = markdownToPlainText(markdown.slice(opener.contentStart, match.index));
    const before = markdownToPlainText(markdown.slice(paragraphStart(markdown, opener.tagStart), opener.tagStart));

    anchors.push({
      blockId,
      discussionIds: discussions.flatMap((discussion) => (discussion ? [discussion.discussionId] : [])),
      text,
      occurrence: countOccurrences(before, text),
    });
  }

  return anchors;
}

/** Parse `discussion://PAGE/BLOCK/DISCUSSION`. */
function parseDiscussionUrl(url: string): { blockId: string; discussionId: string } | null {
  const match = url.trim().match(/^discussion:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) {
    return null;
  }

  return { blockId: normalizeId(match[2]), discussionId: normalizeId(match[3]) };
}

/**
 * Where the paragraph containing `index` starts: just after the previous line
 * break, skipping over hard line breaks (a backslash at the end of a line),
 * which stay within one block.
 */
function paragraphStart(markdown: string, index: number): number {
  let start = markdown.lastIndexOf('\n', index - 1);

  while (start > 0 && markdown[start - 1] === '\\') {
    start = markdown.lastIndexOf('\n', start - 2);
  }

  return start + 1;
}

/**
 * Reduce Notion-flavored Markdown to the text a reader sees, so it can be
 * compared with the block's rich-text `plain_text`. Only inline syntax matters
 * here: anchors never span blocks.
 */
export function markdownToPlainText(markdown: string): string {
  const withoutMarkup = markdown
    // Links keep their text: [text](url) → text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Tags (<span>, <b>, <mention>, …) are dropped; their contents stay.
    .replace(/<[^>]+>/g, '');

  // Drop emphasis, code and math delimiters, keeping escaped characters.
  let plain = '';
  for (let i = 0; i < withoutMarkup.length; i++) {
    const char = withoutMarkup[i];

    if (char === '\\' && i + 1 < withoutMarkup.length) {
      plain += withoutMarkup[++i];
    } else if (char === '*' || char === '`' || char === '$') {
      continue;
    } else if (char === '~' && withoutMarkup[i + 1] === '~') {
      i++;
    } else {
      plain += char;
    }
  }

  return decodeEntities(plain);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// ---------------------------------------------------------------------------
// 2. Select footnotes from comments
// ---------------------------------------------------------------------------

/** The parts of a Notion comment we use. */
export type NotionComment = {
  discussion_id: string;
  created_time: string;
  rich_text: RichText[];
};

/**
 * Pick the discussions that are footnotes, and their note text. A discussion
 * is a footnote only if its first comment starts with "Footnote: ".
 */
export function selectFootnotes(comments: NotionComment[]): Record<string, RichText[]> {
  // The earliest comment in each discussion.
  const firstComments = new Map<string, NotionComment>();
  for (const comment of comments) {
    const id = normalizeId(comment.discussion_id);
    const current = firstComments.get(id);

    if (!current || comment.created_time < current.created_time) {
      firstComments.set(id, comment);
    }
  }

  const footnotes: Record<string, RichText[]> = {};
  for (const [id, comment] of firstComments) {
    const text = comment.rich_text.map((run) => run.plain_text).join('');

    if (text.startsWith(FOOTNOTE_PREFIX)) {
      footnotes[id] = removeLeadingCharacters(comment.rich_text, FOOTNOTE_PREFIX.length);
    }
  }

  return footnotes;
}

/** Remove the first `count` characters of text, across as many runs as needed. */
function removeLeadingCharacters(runs: RichText[], count: number): RichText[] {
  const result: RichText[] = [];
  let remaining = count;

  for (const run of runs) {
    if (remaining <= 0) {
      result.push(run);
    } else if (run.plain_text.length <= remaining) {
      remaining -= run.plain_text.length;
    } else {
      result.push(splitRun(run, remaining)[1]);
      remaining = 0;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// 3. Mark anchored text in the block tree
// ---------------------------------------------------------------------------

export type AnchorResult = {
  /** A copy of the block tree with `footnote` set on anchored runs. */
  blocks: Block[];

  /** The footnotes that were anchored. Unanchored footnotes are left out. */
  footnotes: Record<string, RichText[]>;

  /** Anything that couldn't be matched, described by ID only. */
  problems: string[];
};

export function anchorFootnotes(
  blocks: Block[],
  anchors: MarkdownAnchor[],
  footnotes: Record<string, RichText[]>,
): AnchorResult {
  const tree = structuredClone(blocks);
  const blocksById = indexBlocks(tree);
  const anchored: Record<string, RichText[]> = {};
  const problems: string[] = [];
  const failed = new Set<string>();

  for (const anchor of anchors) {
    // Discussions that aren't footnotes are ordinary comments: skip them.
    for (const footnoteId of anchor.discussionIds.filter((id) => id in footnotes)) {
      const problem = markAnchor(blocksById.get(anchor.blockId), anchor, footnoteId);

      if (problem) {
        problems.push(`Footnote ${footnoteId} in block ${anchor.blockId}: ${problem}`);
        failed.add(footnoteId);
      } else {
        anchored[footnoteId] = footnotes[footnoteId];
      }
    }
  }

  // E.g. a footnote comment on a whole block rather than on selected text.
  for (const footnoteId of Object.keys(footnotes)) {
    if (!(footnoteId in anchored) && !failed.has(footnoteId)) {
      problems.push(`Footnote ${footnoteId}: no anchored text found in the page Markdown.`);
    }
  }

  return { blocks: tree, footnotes: anchored, problems };
}

/** Mark one anchor's runs within its block. Returns a problem, or null on success. */
function markAnchor(block: Block | undefined, anchor: MarkdownAnchor, footnoteId: string): string | null {
  if (!block) {
    return 'block not found.';
  }

  const data = block[block.type] as { rich_text?: RichText[] } | undefined;
  if (!data?.rich_text) {
    return `block type "${block.type}" has no rich text.`;
  }

  // Locate the anchor within the block's text.
  const text = data.rich_text.map((run) => run.plain_text).join('');
  const start = nthIndexOf(text, anchor.text, anchor.occurrence);
  if (!anchor.text || start === -1) {
    return 'anchored text not found in the block.';
  }
  const end = start + anchor.text.length;

  // Split runs at the anchor's edges, then mark every run inside it.
  const runs = splitRunsAt(splitRunsAt(data.rich_text, start), end);

  let offset = 0;
  for (const run of runs) {
    const runStart = offset;
    offset += run.plain_text.length;

    const overlapsAnchor = runStart < end && offset > start;
    if (!overlapsAnchor) {
      continue;
    }

    if (run.footnote && run.footnote !== footnoteId) {
      return `overlaps footnote ${run.footnote}; kept the earlier one.`;
    }
    run.footnote = footnoteId;
  }

  data.rich_text = runs;
  return null;
}

/**
 * Split whichever run contains `offset`, so a run boundary falls exactly
 * there. Only text runs can be split; an equation or mention is kept whole, so
 * an anchor that starts or ends inside one covers the entire run.
 */
function splitRunsAt(runs: RichText[], offset: number): RichText[] {
  const result: RichText[] = [];
  let position = 0;

  for (const run of runs) {
    const runStart = position;
    position += run.plain_text.length;

    const isInside = offset > runStart && offset < position;
    if (isInside && run.type === 'text') {
      result.push(...splitRun(run, offset - runStart));
    } else {
      result.push(run);
    }
  }

  return result;
}

/** Split a text run into two at a character offset, keeping its formatting and link. */
function splitRun(run: RichText, at: number): [RichText, RichText] {
  const piece = (from: number, to?: number): RichText => ({
    ...run,
    plain_text: run.plain_text.slice(from, to),
    ...(run.text ? { text: { ...run.text, content: run.text.content.slice(from, to) } } : {}),
  });

  return [piece(0, at), piece(at)];
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Notion IDs appear both with and without dashes. */
export function normalizeId(id: string): string {
  return id.replace(/-/g, '').toLowerCase();
}

function indexBlocks(blocks: Block[], index = new Map<string, Block>()): Map<string, Block> {
  for (const block of blocks) {
    index.set(normalizeId(block.id), block);

    if (block.children) {
      indexBlocks(block.children, index);
    }
  }

  return index;
}

function countOccurrences(text: string, search: string): number {
  if (!search) {
    return 0;
  }

  let count = 0;
  for (let i = text.indexOf(search); i !== -1; i = text.indexOf(search, i + search.length)) {
    count++;
  }

  return count;
}

/** The index of the nth (zero-based) non-overlapping match, or -1. */
function nthIndexOf(text: string, search: string, n: number): number {
  let index = text.indexOf(search);

  for (let i = 0; i < n && index !== -1; i++) {
    index = text.indexOf(search, index + search.length);
  }

  return index;
}
