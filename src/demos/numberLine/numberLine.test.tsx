import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  arrivalsAt,
  configFromParams,
  intervalLabel,
  gapLabel,
  notesFromFifths,
  notesFromSteps,
  stepCaption,
  valueLabel,
  visibleNotes,
} from './model';
import { parseNote } from '../../music/notes';
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

describe('step captions', () => {
  const steps = 'notes=α1|β1|α2,γ2|γ1';

  it('use the author’s text, numbered', () => {
    const stepped = config(`${steps}&captions=Start with α1.|Add β1 702 cents above α1.`);

    expect(stepCaption(stepped, 0)).toBe('Step 1 of 4: Start with α1.');
    expect(stepCaption(stepped, 1)).toBe('Step 2 of 4: Add β1 702 cents above α1.');
  });

  it('say which notes a step adds where there’s no caption', () => {
    const stepped = config(`${steps}&captions=Start with α1.||`);

    expect(stepCaption(stepped, 2)).toBe('Step 3 of 4: Add α2 and γ2.');
    expect(stepCaption(stepped, 3)).toBe('Step 4 of 4: Add γ1.');
  });
});

describe('the home octave in the notes list', () => {
  it('starts from the step that lists home, which can be a step of its own', () => {
    expect(config('notes=α1|α2,home|β1')).toMatchObject({ homeStep: 1, stepCount: 3 });
    expect(config('notes=α1,α2|home')).toMatchObject({ homeStep: 1, stepCount: 2 });
    expect(config('notes=α0,α1,α2').homeStep).toBeNull();
  });

  it('says so in a step that only highlights it', () => {
    expect(stepCaption(config('notes=α1,α2|home'), 1)).toBe('Step 2 of 2: Highlight the home octave, from α1 to α2.');
  });
});

describe('sliding notes in a step-through', () => {
  const walkthrough = config('notes=α1|α2|β1|γ2|γ1');
  const sources = (step: number) =>
    arrivalsAt(walkthrough, step).map(({ note, from, cents }) => `${from.id}→${note.id} ${Math.round(cents)}`);

  it('slide each new note out of the note a fifth or an octave away', () => {
    expect(sources(0)).toEqual([]);
    expect(sources(1)).toEqual(['α1→α2 1200']);
    expect(sources(2)).toEqual(['α1→β1 702']);
    expect(sources(3)).toEqual(['β1→γ2 702']);
    expect(sources(4)).toEqual(['γ2→γ1 -1200']);
  });

  it('prefer a fifth to an octave', () => {
    // β1 could come from β0 (an octave) or α1 (a fifth): the fifth wins.
    expect(arrivalsAt(config('notes=α1,β0|β1'), 1).map(({ from }) => from.id)).toEqual(['α1']);
  });

  it('let notes with no neighbor simply appear', () => {
    expect(arrivalsAt(config('notes=α1|δ1'), 1)).toEqual([]);
  });

  it('count the interval up as the note slides, in the line’s units', () => {
    const [down] = arrivalsAt(walkthrough, 4);

    expect(intervalLabel(down, 'cents', 0.5)).toBe('−600¢');
    expect(intervalLabel(down, 'cents')).toBe('−1200¢');
    expect(intervalLabel(arrivalsAt(walkthrough, 2)[0], 'hertz')).toBe('+100 Hz');
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
  const render = (query = '') =>
    renderToStaticMarkup(<NumberLineDemo params={new URLSearchParams(query)} title="Test" />);

  it('draws every note as a labeled button, in its pitch color', () => {
    const html = render();

    expect(html.match(/class="number-line-note"/g)).toHaveLength(6);
    expect(html).toContain('aria-label="β1, 702 cents"');
    expect(html).not.toContain('Previous step');
  });

  it('starts a step-through at its first step, saying which notes it adds', () => {
    const html = render('notes=α1|β1|α2,γ2|γ1');

    expect(html.match(/class="number-line-note"/g)).toHaveLength(1);
    expect(html).toContain('Step 1 of 4: Start with α1.');
    expect(html).toMatch(/aria-label="Previous step" disabled=""/);
  });

  it('shows no text below the line until there’s an audio error', () => {
    expect(render()).not.toContain('demo-status');
  });

  it('highlights the home octave, from α1 to α2, in α’s color, when asked', () => {
    const band =
      /<rect class="number-line-band"[^>]*fill="#[0-9a-f]{6}"><title>The home octave, from α1 to α2<\/title>/;

    expect(render('notes=α0,α1,α2,home')).toMatch(band);
    expect(render('notes=α0,α1,α2')).not.toContain('number-line-band');
    expect(render('fifths=5')).not.toContain('number-line-band');
  });

  it('only highlights it from its step on in a step-through', () => {
    expect(render('notes=α1|α2,home|β1')).not.toContain('number-line-band'); // starts at step 1
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
