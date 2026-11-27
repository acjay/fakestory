import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  configFromParams,
  gapLabel,
  notesFromFifths,
  notesFromSteps,
  parseNote,
  valueLabel,
  visibleNotes,
} from './model';
import { NumberLineDemo } from './NumberLineDemo';

const config = (query: string) => configFromParams(new URLSearchParams(query));
const ids = (notes: { id: string }[]) => notes.map((lineNote) => lineNote.id);

describe('number line notes', () => {
  it('parse names as a Greek letter and an octave', () => {
    expect(parseNote('γ2')).toMatchObject({ pitchClass: { name: 'γ' }, octave: 2 });
    expect(parseNote('α-1')).toMatchObject({ octave: -1 });
    expect(parseNote('x1')).toBeNull();
    expect(parseNote('γ')).toBeNull();
  });

  it('match the original demos’ frequencies and cents', () => {
    const notes = notesFromSteps('α0,β0,α1,β1,α2,β2,γ2');

    expect(notes.map((lineNote) => valueLabel(lineNote, 'hertz'))).toEqual([
      '100 Hz',
      '150 Hz',
      '200 Hz',
      '300 Hz',
      '400 Hz',
      '600 Hz',
      '450 Hz',
    ]);
    expect(notes.map((lineNote) => valueLabel(lineNote, 'cents'))).toEqual([
      '-1200¢',
      '-498¢',
      '0¢',
      '702¢',
      '1200¢',
      '1902¢',
      '1404¢',
    ]);
  });

  it('follow the reader’s base frequency', () => {
    const [beta] = notesFromSteps('β1');

    expect(valueLabel(beta, 'hertz', 110)).toBe('165 Hz');
    expect(valueLabel(beta, 'cents', 110)).toBe('702¢');
  });

  it('split into steps at |, skipping unknown and repeated notes', () => {
    const notes = notesFromSteps('α1|β1|α2, γ2|bogus|γ1,α1');

    expect(notes.map(({ id, step }) => `${id}@${step}`)).toEqual(['α1@0', 'β1@1', 'α2@2', 'γ2@2', 'γ1@3']);
  });

  it('stack fifths into the home octave, closed by α2', () => {
    expect(ids(notesFromFifths(5))).toEqual(['α1', 'β1', 'γ1', 'δ1', 'ε1', 'α2']);
    expect(ids(visibleNotes(config('fifths=5'), 0))).toEqual(['α1', 'γ1', 'ε1', 'β1', 'δ1', 'α2']);
  });

  it('label gaps in the line’s own units', () => {
    const [alpha, gamma] = notesFromSteps('α1,γ1');

    expect(gapLabel(alpha, gamma, 'cents')).toBe('+204¢');
    expect(gapLabel(alpha, gamma, 'hertz')).toBe('+25 Hz');
  });
});

describe('number line configuration', () => {
  it('defaults to the α and β notes by cents, without gaps or steps', () => {
    const { notes, scale, showGaps, stepCount } = config('');

    expect(ids(notes)).toEqual(['α0', 'β0', 'α1', 'β1', 'α2', 'β2']);
    expect({ scale, showGaps, stepCount }).toEqual({ scale: 'cents', showGaps: false, stepCount: 1 });
  });

  it('reads notes, fifths, scale and gaps from the URL', () => {
    expect(config('scale=hertz&gaps=1')).toMatchObject({ scale: 'hertz', showGaps: true });
    expect(config('notes=α1|β1|α2,γ2|γ1').stepCount).toBe(4);
    expect(config('fifths=12').notes).toHaveLength(13);
  });

  it('falls back to the default for invalid values', () => {
    expect(ids(config('notes=nonsense').notes)).toEqual(ids(config('').notes));
    expect(ids(config('fifths=40').notes)).toEqual(ids(config('').notes));
    expect(config('scale=loud').scale).toBe('cents');
  });
});

describe('number line demo', () => {
  const render = (query = '') => renderToStaticMarkup(<NumberLineDemo params={new URLSearchParams(query)} />);

  it('draws every note as a labeled button, in its pitch color', () => {
    const html = render();

    expect(html.match(/class="number-line-note"/g)).toHaveLength(6);
    expect(html).toContain('aria-label="β1, 702 cents"');
    expect(html).not.toContain('Previous step');
  });

  it('starts a step-through at its first step', () => {
    const html = render('notes=α1|β1|α2,γ2|γ1');

    expect(html.match(/class="number-line-note"/g)).toHaveLength(1);
    expect(html).toContain('Step 1 of 4: starting with α1.');
    expect(html).toMatch(/aria-label="Previous step" disabled=""/);
  });

  it('labels gaps, and describes them for screen readers', () => {
    const html = render('fifths=5&gaps=1');

    expect(html.match(/class="number-line-gap"/g)).toHaveLength(5);
    expect(html).toContain('Gaps: +204¢, +204¢, +294¢, +204¢, +294¢.');
  });

  it('shows hertz on a frequency line', () => {
    expect(render('scale=hertz')).toContain('aria-label="β2, 600 Hz"');
  });
});
