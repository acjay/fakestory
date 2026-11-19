import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Reader } from './Reader';
import { fixture } from './fixture';
import { parseReference, safeHref } from './links';

describe('Reader', () => {
  it('renders columns, equations, references and demo placeholder', () => {
    const html = renderToStaticMarkup(<Reader story={fixture} />);
    expect(html).toContain('class="columns"');
    expect(html).toContain('katex');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Why a ratio?');
    expect(html).toContain('Not yet implemented');
  });
  it('constrains reference patterns and rejects unsafe links', () => {
    expect(parseReference('https://fakestory.music/terminology/octave')).toEqual({ kind: 'glossary', id: 'octave' });
    expect(parseReference('https://other.example/terminology/octave')).toBeNull();
    expect(parseReference('https://fakestory.music/terminology/octave?x=1')).toBeNull();
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
  });
  it('renders an explicit unsupported-block notice rather than dropping content', () => {
    const story = { ...fixture, blocks: [{ id: 'x', type: 'video', video: {} }] };
    expect(renderToStaticMarkup(<Reader story={story} />)).toContain('Unsupported block: video');
  });
});
