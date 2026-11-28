import { describe, expect, it } from 'vitest';

import {
  anchorFootnotes,
  findAnchors,
  markdownToPlainText,
  selectFootnotes,
  type MarkdownAnchor,
  type NotionComment,
} from '../scripts/footnotes.ts';
import type { Block, RichText } from '../src/model.ts';

// IDs as Notion writes them in discussion URLs (dashed) and in blocks.
const PAGE = '965fc5b8-e2dc-4c97-9ee5-82f68d17c408';
const BLOCK = '10d5fa8f-f6f5-800d-929c-d36ac94ac15f';
const DISCUSSION = '10d5fa8f-f6f5-80ef-9783-001c25a664f4';
const OTHER = '20d5fa8f-f6f5-80ef-9783-001c25a664f4';

const blockId = BLOCK.replace(/-/g, '');
const discussionId = DISCUSSION.replace(/-/g, '');
const otherId = OTHER.replace(/-/g, '');

const url = (discussion: string) => `discussion://${PAGE}/${BLOCK}/${discussion}`;

const text = (plain_text: string, annotations?: RichText['annotations']): RichText => ({
  type: 'text',
  plain_text,
  text: { content: plain_text },
  ...(annotations ? { annotations } : {}),
});

const paragraph = (...rich_text: RichText[]): Block => ({ id: BLOCK, type: 'paragraph', paragraph: { rich_text } });

const comment = (discussion: string, created_time: string, ...rich_text: RichText[]): NotionComment => ({
  discussion_id: discussion,
  created_time,
  rich_text,
});

/** The runs of the first block, as [text, footnote] pairs. */
const runsOf = (blocks: Block[]) =>
  (blocks[0].paragraph as { rich_text: RichText[] }).rich_text.map((run) => [run.plain_text, run.footnote]);

describe('findAnchors', () => {
  it('finds a commented span, with its block and discussion', () => {
    const markdown = `As they say, <span discussion-urls="${url(DISCUSSION)}">“the map is not the territory”.</span>`;

    expect(findAnchors(markdown)).toEqual([
      { blockId, discussionIds: [discussionId], text: '“the map is not the territory”.', occurrence: 0 },
    ]);
  });

  it('handles other attributes, nested spans, inline markup and several discussions', () => {
    const markdown =
      `<span color="red" discussion-urls="${url(DISCUSSION)},${url(OTHER)}">` +
      `**Bold** and <span color="blue">[linked](https://example.com)</span> $x^2$</span>`;

    const [anchor] = findAnchors(markdown);

    expect(anchor.text).toBe('Bold and linked x^2');
    expect(anchor.discussionIds).toEqual([discussionId, otherId]);
  });

  it('counts earlier occurrences of the same phrase in the paragraph only', () => {
    const markdown = [
      'An octave above another octave.',
      '',
      `One octave, then <span discussion-urls="${url(DISCUSSION)}">octave</span> again.`,
    ].join('\n');

    expect(findAnchors(markdown)[0].occurrence).toBe(1);
  });

  it('ignores spans without discussions', () => {
    expect(findAnchors('<span color="red">Just colored</span>')).toEqual([]);
  });
});

describe('markdownToPlainText', () => {
  it('keeps escaped characters and decodes entities', () => {
    expect(markdownToPlainText('5 \\* 3 &lt;tag&gt; ~~gone~~ `code`')).toBe('5 * 3 <tag> gone code');
  });
});

describe('selectFootnotes', () => {
  it('keeps only discussions whose first comment starts with "Footnote: ", without the prefix', () => {
    const footnotes = selectFootnotes([
      comment(DISCUSSION, '2024-01-01T00:00:00Z', text('Footnote: The '), text('real', { bold: true }), text(' note.')),
      comment(OTHER, '2024-01-01T00:00:00Z', text('Idea: maybe later')),
    ]);

    expect(Object.keys(footnotes)).toEqual([discussionId]);
    expect(footnotes[discussionId].map((run) => run.plain_text)).toEqual(['The ', 'real', ' note.']);
    expect(footnotes[discussionId][0].text?.content).toBe('The ');
  });

  it('removes a prefix that is split across runs', () => {
    const footnotes = selectFootnotes([comment(DISCUSSION, '2024-01-01T00:00:00Z', text('Foot'), text('note: Hi'))]);

    expect(footnotes[discussionId].map((run) => run.plain_text)).toEqual(['Hi']);
  });

  it('judges a discussion by its first comment, never by replies', () => {
    const footnotes = selectFootnotes([
      // Listed out of order: the reply is later.
      comment(OTHER, '2024-02-01T00:00:00Z', text('Footnote: a reply is not a footnote')),
      comment(OTHER, '2024-01-01T00:00:00Z', text('Idea: the original comment')),
      comment(DISCUSSION, '2024-01-01T00:00:00Z', text('Footnote: kept')),
      comment(DISCUSSION, '2024-02-01T00:00:00Z', text('Idea: a reply')),
    ]);

    expect(Object.keys(footnotes)).toEqual([discussionId]);
    expect(footnotes[discussionId].map((run) => run.plain_text)).toEqual(['kept']);
  });

  it('requires the exact prefix', () => {
    expect(selectFootnotes([comment(DISCUSSION, '2024-01-01T00:00:00Z', text('footnote: lowercase'))])).toEqual({});
  });
});

describe('anchorFootnotes', () => {
  const note = [text('A note.')];
  const anchor = (text: string, occurrence = 0): MarkdownAnchor => ({
    blockId,
    discussionIds: [discussionId],
    text,
    occurrence,
  });

  it('splits runs so only the anchored words are marked', () => {
    const blocks = [paragraph(text('As they say, the map is not the territory.'))];

    const result = anchorFootnotes(blocks, [anchor('the map')], { [discussionId]: note });

    expect(runsOf(result.blocks)).toEqual([
      ['As they say, ', undefined],
      ['the map', discussionId],
      [' is not the territory.', undefined],
    ]);
    expect(result.footnotes).toEqual({ [discussionId]: note });
    expect(result.problems).toEqual([]);
  });

  it('marks every run of an anchor that crosses formatting, keeping the formatting', () => {
    const blocks = [paragraph(text('Plain '), text('bold', { bold: true }), text(' end'))];

    const result = anchorFootnotes(blocks, [anchor('ain bold e')], { [discussionId]: note });

    expect(runsOf(result.blocks)).toEqual([
      ['Pl', undefined],
      ['ain ', discussionId],
      ['bold', discussionId],
      [' e', discussionId],
      ['nd', undefined],
    ]);
    const runs = (result.blocks[0].paragraph as { rich_text: RichText[] }).rich_text;
    expect(runs[2].annotations).toEqual({ bold: true });
  });

  it('uses the occurrence to pick the right repeated phrase', () => {
    const blocks = [paragraph(text('octave, octave, octave'))];

    const result = anchorFootnotes(blocks, [anchor('octave', 1)], { [discussionId]: note });

    expect(runsOf(result.blocks)).toEqual([
      ['octave, ', undefined],
      ['octave', discussionId],
      [', octave', undefined],
    ]);
  });

  it('keeps an equation whole when an anchor ends inside it', () => {
    const equation: RichText = { type: 'equation', plain_text: 'f_2 = 2f_1', equation: { expression: 'f_2 = 2f_1' } };
    const blocks = [paragraph(text('So '), equation)];

    const result = anchorFootnotes(blocks, [anchor('So f_2')], { [discussionId]: note });

    expect(runsOf(result.blocks)).toEqual([
      ['So ', discussionId],
      ['f_2 = 2f_1', discussionId],
    ]);
  });

  it('ignores comments that are not footnotes', () => {
    const blocks = [paragraph(text('Just a comment.'))];

    const result = anchorFootnotes(blocks, [anchor('comment')], {});

    expect(runsOf(result.blocks)).toEqual([['Just a comment.', undefined]]);
    expect(result.problems).toEqual([]);
  });

  it('reports anchors it cannot place, by ID only, and leaves the input unchanged', () => {
    const blocks = [paragraph(text('Some secret story text.'))];

    const result = anchorFootnotes(blocks, [anchor('missing words')], { [discussionId]: note });

    expect(result.problems).toEqual([
      `Footnote ${discussionId} in block ${blockId}: anchored text not found in the block.`,
    ]);
    expect(result.problems.join()).not.toContain('secret');
    expect(result.footnotes).toEqual({});
    expect(runsOf(blocks)).toEqual([['Some secret story text.', undefined]]);
  });

  it('reports footnotes with no anchor at all', () => {
    const result = anchorFootnotes([paragraph(text('Text.'))], [], { [discussionId]: note });

    expect(result.problems).toEqual([`Footnote ${discussionId}: no anchored text found in the page Markdown.`]);
  });

  describe('in tables', () => {
    const row = (id: string, ...cells: string[]): Block => ({
      id,
      type: 'table_row',
      table_row: { cells: cells.map((cell) => [text(cell)]) },
    });
    const cellsOf = (block: Block) =>
      (block.table_row as { cells: RichText[][] }).cells.map((cell) =>
        cell.map((run) => [run.plain_text, run.footnote]),
      );

    it('anchors within a table row cell', () => {
      const table: Block = {
        id: 'table',
        type: 'table',
        table: { table_width: 2 },
        children: [row(BLOCK, 'Octave', 'Ratio 2:1')],
      };

      const result = anchorFootnotes([table], [anchor('2:1')], { [discussionId]: note });

      expect(result.problems).toEqual([]);
      expect(cellsOf(result.blocks[0].children![0])).toEqual([
        [['Octave', undefined]],
        [
          ['Ratio ', undefined],
          ['2:1', discussionId],
        ],
      ]);
    });

    it('counts occurrences across cells, without matching across a cell boundary', () => {
      const blocks = [row(BLOCK, 'fifth', 'fifth and fifth')];

      const result = anchorFootnotes(blocks, [anchor('fifth', 2)], { [discussionId]: note });

      expect(cellsOf(result.blocks[0])).toEqual([
        [['fifth', undefined]],
        [
          ['fifth and ', undefined],
          ['fifth', discussionId],
        ],
      ]);
    });

    it('finds an anchor attributed to the table rather than the row', () => {
      const table: Block = { id: BLOCK, type: 'table', table: {}, children: [row('r1', 'A', 'B note')] };

      const result = anchorFootnotes([table], [anchor('note')], { [discussionId]: note });

      expect(result.problems).toEqual([]);
      expect(cellsOf(result.blocks[0].children![0])[1]).toEqual([
        ['B ', undefined],
        ['note', discussionId],
      ]);
    });
  });
});
