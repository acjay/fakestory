import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { colorForCents } from '../../music/colors';
import { circleNotes, frequencyFor, octaveFor, sizeFromParams, statisticsTable } from './model';
import { ScaleGeneratorDemo } from './ScaleGeneratorDemo';

describe('scale generator model', () => {
  it('starts at 12 notes, or the size in the embed URL', () => {
    expect(sizeFromParams(new URLSearchParams(''))).toBe(12);
    expect(sizeFromParams(new URLSearchParams('size=7'))).toBe(7);
    expect(sizeFromParams(new URLSearchParams('size=0'))).toBe(12);
    expect(sizeFromParams(new URLSearchParams('size=2.5'))).toBe(12);
  });

  it('names the notes in stacking order, each in its pitch color', () => {
    const notes = circleNotes(5);

    expect(notes.map((note) => note.label)).toEqual(['α', 'β', 'γ', 'δ', 'ε']);
    expect(notes[1].color).toEqual(colorForCents(notes[1].cents));
  });

  it('groups the statistics table by 12 sizes', () => {
    const table = statisticsTable(14);

    expect(table.map((group) => group.length)).toEqual([12, 2]);
    expect(table[0][4].statistics.sizes).toBe(2); // 5 notes: two gap sizes
  });

  it('plays notes in the chosen octave, with Shift and Ctrl/⌘ as shortcuts', () => {
    expect(frequencyFor(0, 0)).toBe(200);
    expect(frequencyFor(0, 1)).toBe(400);
    expect(frequencyFor(1200 * Math.log2(1.5), -1)).toBeCloseTo(150, 9);

    expect(octaveFor(0, { shift: false, down: false })).toBe(0);
    expect(octaveFor(-1, { shift: true, down: false })).toBe(1);
    expect(octaveFor(1, { shift: false, down: true })).toBe(-1);
  });
});

describe('scale generator demo', () => {
  const render = (query = '') =>
    renderToStaticMarkup(<ScaleGeneratorDemo params={new URLSearchParams(query)} title="Test" />);

  it('draws each note as a labeled button', () => {
    const html = render('size=3');

    expect(html.match(/class="octave-circle-note"/g)).toHaveLength(3);
    expect(html).toContain('role="button" tabindex="0" aria-label="γ, 204 cents"');
  });

  it('labels the gaps while there is room, and hides them when crowded', () => {
    expect(render('size=5')).toContain('+294¢');
    expect(render('size=30')).not.toContain('octave-circle-gap');
  });

  it('labels the size controls and highlights the current size in the table', () => {
    const html = render('size=7');

    expect(html).toContain('aria-label="Add a fifth above the last note"');
    expect(html).toContain('7 notes');
    expect(html).toMatch(/<th scope="col" aria-current="true">7<\/th>/);
  });

  it('moves notes a comma apart onto an inner ring so they never overlap', () => {
    // 13 notes: ν lands a comma above α.
    expect(render('size=12')).not.toContain('octave-circle-tick');
    expect(render('size=13').match(/octave-circle-tick/g)).toHaveLength(1);
  });

  it('disables removing the last note', () => {
    expect(render('size=1')).toMatch(/aria-label="Remove the last note" disabled=""/);
  });
});
