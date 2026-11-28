import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { buttonsFromParams, frequenciesOf, hertzLabel } from './model';
import { NoteButtonsDemo } from './NoteButtonsDemo';

const buttons = (query: string) => buttonsFromParams(new URLSearchParams(query));

describe('note buttons configuration', () => {
  it('defaults to one button for the base tone', () => {
    expect(buttons('').map((button) => button.label)).toEqual(['α1']);
  });

  it('splits buttons at | and joins notes played together with ,', () => {
    expect(buttons('buttons=α1,γ1|α1,β1').map((button) => button.label)).toEqual(['α1 & γ1', 'α1 & β1']);
  });

  it('skips unknown notes, and buttons left empty', () => {
    expect(buttons('buttons=α1,bogus|nonsense|β1').map((button) => button.label)).toEqual(['α1', 'β1']);
    expect(buttons('buttons=nonsense').map((button) => button.label)).toEqual(['α1']);
  });

  it('match the original demos’ frequencies, and follow the reader’s base', () => {
    expect(['α1', 'α2', 'α0'].map((name) => hertzLabel(buttons(`buttons=${name}`)[0]))).toEqual([
      '200 Hz',
      '400 Hz',
      '100 Hz',
    ]);

    const [fourth, fifth] = buttons('buttons=α1,γ1|α1,β1');
    expect(frequenciesOf(fourth)).toEqual([200, 225]);
    expect(hertzLabel(fifth)).toBe('200 + 300 Hz');
    expect(hertzLabel(fifth, 110)).toBe('110 + 165 Hz');
  });
});

describe('note buttons demo', () => {
  const render = (query = '') =>
    renderToStaticMarkup(<NoteButtonsDemo params={new URLSearchParams(query)} title="Test" />);

  it('labels each button for screen readers, single notes and notes together', () => {
    expect(render()).toContain('aria-label="Play α1, 200 hertz"');
    expect(render('buttons=α1,γ1')).toContain('aria-label="Play α1 and γ1 together, 200 and 225 hertz"');
  });

  it('shows each note in its pitch color, with the hertz', () => {
    const html = render('buttons=α1,β1');

    expect(html.match(/class="note-button-swatch"/g)).toHaveLength(2);
    expect(html).toContain('<span class="note-button-hertz">200 + 300 Hz</span>');
  });

  it('shows no status text: the playing button pulses instead', () => {
    expect(render()).not.toContain('demo-status');
  });
});
