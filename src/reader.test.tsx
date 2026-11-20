import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { fixture } from './fixture';
import { parseGlossaryLink, safeHref } from './links';
import type { Block, RichText, Story } from './model';
import { Reader } from './Reader';

const text = (plain_text: string, footnote?: string): RichText => ({ type: 'text', plain_text, footnote });

/** Render a story with a single paragraph. */
const renderParagraph = (rich_text: RichText[], footnotes: Story['footnotes'] = {}) =>
  renderToStaticMarkup(
    <Reader story={{ ...fixture, footnotes, blocks: [{ id: 'p', type: 'paragraph', paragraph: { rich_text } }] }} />,
  );

describe('Reader', () => {
  it('renders columns, equations, references and demo placeholder', () => {
    const html = renderToStaticMarkup(<Reader story={fixture} />);

    expect(html).toContain('class="columns"');
    expect(html).toContain('katex');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Not yet implemented');
  });

  it('renders an explicit unsupported-block notice rather than dropping content', () => {
    const story = { ...fixture, blocks: [{ id: 'x', type: 'video', video: {} }] };

    expect(renderToStaticMarkup(<Reader story={story} />)).toContain('Unsupported block: video');
  });
});

describe('lists', () => {
  const item = (id: string, type: string, label: string, children?: Block[]): Block => ({
    id,
    type,
    [type]: { rich_text: [text(label)] },
    ...(children ? { has_children: true, children } : {}),
  });
  const render = (blocks: Block[]) => renderToStaticMarkup(<Reader story={{ ...fixture, blocks }} />);

  it('groups consecutive items into one list, nesting children', () => {
    const html = render([
      item('a', 'bulleted_list_item', 'A', [item('a1', 'bulleted_list_item', 'A1')]),
      item('b', 'bulleted_list_item', 'B'),
    ]);

    expect(html).toContain('<ul><li>A<ul><li>A1</li></ul></li><li>B</li></ul>');
  });

  it('starts a new list when the type changes or another block interrupts', () => {
    const html = render([
      item('a', 'numbered_list_item', 'One'),
      item('b', 'numbered_list_item', 'Two'),
      item('c', 'bulleted_list_item', 'Dot'),
      item('p', 'paragraph', 'Break'),
      item('d', 'bulleted_list_item', 'Dot again'),
    ]);

    expect(html).toContain(
      '<ol><li>One</li><li>Two</li></ol><ul><li>Dot</li></ul><p>Break</p><ul><li>Dot again</li></ul>',
    );
  });
});

describe('tables, callouts and synced blocks', () => {
  const render = (blocks: Block[]) => renderToStaticMarkup(<Reader story={{ ...fixture, blocks }} />);
  const row = (id: string, ...cells: string[]): Block => ({
    id,
    type: 'table_row',
    table_row: { cells: cells.map((cell) => [text(cell)]) },
  });

  it('renders a table with column and row headers', () => {
    const html = render([
      {
        id: 't',
        type: 'table',
        table: { has_column_header: true, has_row_header: true },
        children: [row('h', 'Name', 'Ratio'), row('r', 'Octave', '2:1')],
      },
    ]);

    expect(html).toContain(
      '<thead><tr><th scope="col">Name</th><th scope="col">Ratio</th></tr></thead>' +
        '<tbody><tr><th scope="row">Octave</th><td>2:1</td></tr></tbody>',
    );
  });

  it('renders a table without headers as plain cells', () => {
    const html = render([{ id: 't', type: 'table', table: {}, children: [row('r', 'A', 'B')] }]);

    expect(html).toContain('<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>');
  });

  it('renders a callout with its emoji and color', () => {
    const html = render([
      {
        id: 'c',
        type: 'callout',
        callout: { rich_text: [text('Heads up')], icon: { type: 'emoji', emoji: '💡' }, color: 'blue_background' },
      },
    ]);

    expect(html).toContain(
      '<aside class="callout" data-color="blue_background"><span class="callout-icon" aria-hidden="true">💡</span>' +
        '<div class="callout-body"><p>Heads up</p></div></aside>',
    );
  });

  it('renders a synced block as its content, or a notice if it has none', () => {
    const paragraph: Block = { id: 'p', type: 'paragraph', paragraph: { rich_text: [text('Shared')] } };

    expect(render([{ id: 's', type: 'synced_block', synced_block: {}, children: [paragraph] }])).toContain(
      '<div class="reading"><p>Shared</p></div>',
    );
    expect(render([{ id: 's', type: 'synced_block', synced_block: {} }])).toContain('Synced block with no content');
  });
});

describe('footnotes', () => {
  it('renders the anchor and its marker button as one unit', () => {
    const html = renderParagraph([text('Before '), text('anchored', 'n1'), text(' after.')], {
      n1: [text('The note.')],
    });

    expect(html).toContain(
      '<span class="footnote">anchored<span class="inline-detail">' +
        '<button type="button" class="footnote-marker" aria-label="Footnote" aria-expanded="false">' +
        '<span aria-hidden="true">♪</span></button></span></span>',
    );
    // Closed by default: the note isn't rendered until opened.
    expect(html).not.toContain('The note.');
  });

  it('wraps an anchor that spans several runs once, with one marker', () => {
    const bold: RichText = { ...text('bold', 'n1'), annotations: { bold: true } };
    const html = renderParagraph([text('plain ', 'n1'), bold], { n1: [text('Note.')] });

    expect(html).toContain('<span class="footnote">plain <strong>bold</strong><span class="inline-detail">');
    expect(html.match(/footnote-marker/g)).toHaveLength(1);
  });

  it('renders anchored text without a marker if the note is missing', () => {
    const html = renderParagraph([text('orphan', 'missing')]);

    expect(html).toContain('<p>orphan</p>');
  });
});

describe('links', () => {
  it('constrains glossary links and rejects unsafe ones', () => {
    expect(parseGlossaryLink('https://fakestory.music/terminology/octave')).toBe('octave');
    expect(parseGlossaryLink('https://fakestory.music/glossary/octave')).toBe('octave');
    expect(parseGlossaryLink('https://other.example/terminology/octave')).toBeNull();
    expect(parseGlossaryLink('https://fakestory.music/terminology/octave?x=1')).toBeNull();
    expect(parseGlossaryLink('https://fakestory.music/footnotes/octave')).toBeNull();
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
  });
});
