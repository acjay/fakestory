import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { fixture } from '../fixture';
import type { Block } from '../model';
import { Reader } from '../Reader';
import { DemoIndex } from './DemoIndex';
import { HarmonicToneDemo } from './harmonicTone/HarmonicToneDemo';
import { NoteButtonsDemo } from './noteButtons/NoteButtonsDemo';
import { NumberLineDemo } from './numberLine/NumberLineDemo';
import { ScaleGeneratorDemo } from './scaleGenerator/ScaleGeneratorDemo';
import { DEMOS, demoFromUrl, demoTitle, TITLE_PARAMETER } from './registry';

describe('demo URLs', () => {
  it('recognize our demos, with their configuration', () => {
    const demo = demoFromUrl('https://fakestory.music/demos/harmonic-tone/?through=1');

    expect(demo?.slug).toBe('harmonic-tone');
    expect(demo?.params.get('through')).toBe('1');
    expect(demoFromUrl('https://fakestory.music/demos/harmonic-tone')?.slug).toBe('harmonic-tone');
  });

  it('recognize production, including from a preview build on another host', () => {
    const demo = demoFromUrl(
      'https://fakestory.alanjay1.workers.dev/demos/scale-generator/?size=7',
      'hosting-fakestory.alanjay1.workers.dev',
    );

    expect(demo?.slug).toBe('scale-generator');
  });

  it('recognize the page’s own host, for local development', () => {
    expect(demoFromUrl('http://localhost:5173/demos/harmonic-tone/', 'localhost:5173')?.slug).toBe('harmonic-tone');
  });

  it('never treat other sites, unknown demos or other schemes as ours', () => {
    expect(demoFromUrl('https://example.com/demos/harmonic-tone/', 'localhost:5173')).toBeNull();
    expect(demoFromUrl('https://fakestory.music/demos/no-such-demo/')).toBeNull();
    expect(demoFromUrl('https://fakestory.music/other/harmonic-tone/')).toBeNull();
    expect(demoFromUrl('ftp://fakestory.music/demos/harmonic-tone/')).toBeNull();
    expect(demoFromUrl('https://codepen.io/acjay/embed/WNVQWKx')).toBeNull();
    expect(demoFromUrl(undefined)).toBeNull();
  });
});

describe('demos in the story', () => {
  const render = (url: string) => {
    const embed: Block = { id: 'e', type: 'embed', embed: { url } };
    return renderToStaticMarkup(<Reader story={{ ...fixture, blocks: [embed] }} />);
  };

  it('render our demo in place of the embed', () => {
    const html = render('https://fakestory.music/demos/harmonic-tone/');

    expect(html).toContain('class="demo-embed"');
    expect(html).toContain('Play tone');
    expect(html).not.toContain('Not yet implemented');
  });

  it('show a placeholder for any other embed, without loading it', () => {
    const html = render('https://codepen.io/acjay/embed/WNVQWKx');

    expect(html).toContain('Not yet implemented');
    expect(html).not.toContain('codepen');
  });
});

describe('harmonic tone demo', () => {
  const render = (query = '') =>
    renderToStaticMarkup(<HarmonicToneDemo params={new URLSearchParams(query)} title="Test" />);

  it('starts at 200 Hz with harmonics 1–4 and 8 rows', () => {
    const html = render();

    expect(html).toContain('value="200"');
    expect(html).toContain('4 partials enabled');
    expect(html.match(/<li class="harmonic-row/g)).toHaveLength(8);
    expect(html).toContain('Show all 16 harmonics');
    expect(html).toContain('Audio stopped');
  });

  it('marks the active preset', () => {
    expect(render()).toMatch(/aria-pressed="true"[^>]*>4</);
  });

  it('shows all 16 rows when configured through harmonic 16', () => {
    const html = render('through=16');

    expect(html.match(/<li class="harmonic-row/g)).toHaveLength(16);
    expect(html).not.toContain('Show all 16 harmonics');
  });

  it('labels every control and graph for screen readers', () => {
    const html = render();

    expect(html).toContain('aria-label="Fundamental frequency in hertz"');
    expect(html).toContain('aria-label="Hear partial 1 alone"');
    expect(html).toContain('role="img" aria-label="Combined waveform of 4 enabled partials at 200 hertz');
    expect(html).toContain('aria-label="Partial 5 at 1000 hertz, amplitude 0.2, not included."');
  });
});

describe('demo index', () => {
  it('lists every demo with its page, embed URL and parameters', () => {
    const html = renderToStaticMarkup(<DemoIndex origin="https://fakestory.music" />);

    expect(html).toContain('<a href="/demos/harmonic-tone/">Harmonic tone</a>');
    expect(html).toContain('<code>https://fakestory.music/demos/harmonic-tone/</code>');
    expect(html).toContain('<code>through</code>');
  });

  it('links every variant, with a URL ready to copy', () => {
    const html = renderToStaticMarkup(<DemoIndex origin="https://fakestory.music" />);

    expect(html).toContain(
      '<a href="/demos/number-line/?fifths=5&amp;gaps=1&amp;title=The%20quest%20for%20even%20spacing">The quest for even spacing: 5 notes</a>',
    );
    expect(html).toContain(
      '<code>https://fakestory.music/demos/number-line/?fifths=5&amp;gaps=1&amp;title=The quest for even spacing</code>',
    );
    expect(html).toContain('<a href="/demos/scale-generator/?size=5">');
  });

  it('copies variant URLs percent-encoded, so captions survive pasting', () => {
    const html = renderToStaticMarkup(<DemoIndex origin="https://fakestory.music" />);

    expect(html).toContain(
      'captions=Start with α1.|Add α2 an octave (1200 cents) above α1 to define our home octave.|',
    );
    expect(html).toContain('href="/demos/number-line/?notes=%CE%B11%7C');
  });

  it('only lists variants that the demo itself accepts', () => {
    for (const [slug, demo] of Object.entries(DEMOS)) {
      const accepted = new Set([...demo.parameters.map((parameter) => parameter.name), TITLE_PARAMETER]);

      for (const variant of demo.variants) {
        for (const name of new URLSearchParams(variant.query).keys()) {
          expect(accepted, `${slug}: ${variant.name}`).toContain(name);
        }
      }
    }
  });
});

describe('demo header', () => {
  const demos = [
    renderToStaticMarkup(<HarmonicToneDemo params={new URLSearchParams('')} title="Test" />),
    renderToStaticMarkup(<ScaleGeneratorDemo params={new URLSearchParams('')} title="Test" />),
    renderToStaticMarkup(<NumberLineDemo params={new URLSearchParams('')} title="Test" />),
    renderToStaticMarkup(<NoteButtonsDemo params={new URLSearchParams('')} title="Test" />),
  ];

  it('starts every demo with "Demo:" and its title', () => {
    for (const html of demos) {
      expect(html).toMatch(
        /^<div class="demo [^"]*"><div class="demo-header"><p class="demo-header-title"><span class="demo-header-kind">Demo:<\/span> Test<\/p>/,
      );
    }
  });

  it('ends with the ♪ tone button, collapsed until opened, naming the current tone', () => {
    for (const html of demos) {
      expect(html).toContain('<button type="button" class="tone-settings-button" aria-expanded="false"');
      expect(html).toContain(
        'aria-label="Tone settings: 200 Hz, square. Applies to every demo." title="Tone settings: 200 Hz, square. Applies to every demo."><span aria-hidden="true">♪</span></button></div></div>',
      );
    }
  });

  it('takes its title from the URL, or else the demo’s name', () => {
    expect(demoTitle('number-line', new URLSearchParams('title=3’s a crowd'))).toBe('3’s a crowd');
    expect(demoTitle('number-line', new URLSearchParams(''))).toBe('Number line');
    expect(demoTitle('number-line', new URLSearchParams('title=%20'))).toBe('Number line');
    expect(demoFromUrl('https://fakestory.music/demos/scale-generator/?title=Five')?.title).toBe('Five');
  });
});
