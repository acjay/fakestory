import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { fixture } from './fixture';
import { parseGlossaryLink, safeHref } from './links';
import type { RichText, Story } from './model';
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

describe('footnotes', () => {
  it('renders the anchor as plain prose followed by a single marker button', () => {
    const html = renderParagraph([text('Before '), text('anchored', 'n1'), text(' after.')], {
      n1: [text('The note.')],
    });

    expect(html).toContain(
      '<span class="footnote"><span class="footnote-anchor">anchored</span>' +
        '<span class="inline-detail"><button type="button" class="footnote-marker" aria-label="Footnote" aria-expanded="false">' +
        '<span aria-hidden="true">♪</span></button></span></span>',
    );
    // Closed by default: the note isn't rendered until opened.
    expect(html).not.toContain('The note.');
  });

  it('wraps an anchor that spans several runs once, with one marker', () => {
    const bold: RichText = { ...text('bold', 'n1'), annotations: { bold: true } };
    const html = renderParagraph([text('plain ', 'n1'), bold], { n1: [text('Note.')] });

    expect(html).toContain('<span class="footnote-anchor">plain <strong>bold</strong></span>');
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
