import { describe, expect, it } from 'vitest';

import { HOME_OCTAVE, note, noteCents, noteFrequency, noteLabel } from './notes';
import { centsToRatio, foldCents, foldIntoOctave, ratioToCents } from './pitch';
import {
  equalTemperamentPitchClass,
  equalTemperamentPitchClasses,
  gapsBetween,
  PYTHAGOREAN_COMMA_CENTS,
  pythagoreanPitchClasses,
} from './pitchClasses';

/** Round to whole cents, as the story writes them. */
const roundCents = (cents: number) => Math.round(cents);

describe('pitch arithmetic', () => {
  it('converts between ratios and cents', () => {
    expect(ratioToCents(2)).toBe(1200);
    expect(ratioToCents(1)).toBe(0);
    expect(roundCents(ratioToCents(3 / 2))).toBe(702);
    expect(centsToRatio(1200)).toBe(2);
    expect(centsToRatio(ratioToCents(1.25))).toBeCloseTo(1.25, 12);
  });

  it('folds ratios into one octave, counting the octaves removed', () => {
    expect(foldIntoOctave(2.25)).toEqual({ ratio: 1.125, octaves: 1 });
    expect(foldIntoOctave(0.75)).toEqual({ ratio: 1.5, octaves: -1 });
    expect(foldIntoOctave(1)).toEqual({ ratio: 1, octaves: 0 });
    expect(foldIntoOctave(2)).toEqual({ ratio: 1, octaves: 1 });
  });

  it('folds cents into one octave', () => {
    expect(foldCents(1404)).toBe(204);
    expect(foldCents(-498)).toBe(702);
    expect(foldCents(1200)).toBe(0);
  });
});

describe('Pythagorean pitch classes', () => {
  const classes = pythagoreanPitchClasses(12);
  const byName = Object.fromEntries(classes.map((pitchClass) => [pitchClass.name, pitchClass]));

  it('are named in stacking order, matching the story', () => {
    expect(classes.map((pitchClass) => pitchClass.name).join('')).toBe('αβγδεζηθικλμ');
  });

  it('match the story’s frequencies at a 200 Hz base', () => {
    const frequencies = Object.fromEntries(
      classes.map((pitchClass) => [pitchClass.name, noteFrequency(note(pitchClass))]),
    );

    expect(frequencies).toMatchObject({ α: 200, β: 300, γ: 225, δ: 337.5, ε: 253.125, ζ: 379.6875, η: 284.765625 });
    expect(frequencies.θ).toBeCloseTo(213.57421875, 9);
    expect(frequencies.ι).toBeCloseTo(320.361328125, 9);
    expect(frequencies.κ).toBeCloseTo(240.2709960938, 9);
    expect(frequencies.λ).toBeCloseTo(360.4064941406, 9);
    expect(frequencies.μ).toBeCloseTo(270.3048706055, 9);
  });

  it('match the story’s cents', () => {
    const cents = classes.map((pitchClass) => roundCents(pitchClass.cents));
    expect(cents).toEqual([0, 702, 204, 906, 408, 1110, 612, 114, 816, 318, 1020, 522]);
    expect(roundCents(byName.ε.cents)).toBe(408);
  });

  it('never close: the comma is about 23.46 cents', () => {
    expect(PYTHAGOREAN_COMMA_CENTS).toBeCloseTo(23.46, 2);

    // The 13th fifth lands one comma above α, not on it.
    const thirteenth = pythagoreanPitchClasses(13)[12];
    expect(thirteenth.cents).toBeCloseTo(PYTHAGOREAN_COMMA_CENTS, 9);
    expect(thirteenth.name).toBe('ν');
  });

  it('are numbered once the Greek names run out', () => {
    expect(pythagoreanPitchClasses(26).at(-1)?.name).toBe('26');
  });
});

describe('gaps between pitch classes', () => {
  const gapCents = (count: number) => gapsBetween(pythagoreanPitchClasses(count)).map((gap) => roundCents(gap.cents));

  it('add up to an octave', () => {
    for (const count of [1, 2, 5, 7, 12, 17]) {
      const total = gapsBetween(pythagoreanPitchClasses(count)).reduce((sum, gap) => sum + gap.cents, 0);
      expect(total).toBeCloseTo(1200, 9);
    }
  });

  it('match the story’s 2-, 3-, 5-, 7- and 12-note sets', () => {
    expect(gapCents(2)).toEqual([702, 498]);
    expect(gapCents(3)).toEqual([204, 498, 498]);
    expect(gapCents(5)).toEqual([204, 204, 294, 204, 294]);
    expect(gapCents(7)).toEqual([204, 204, 204, 90, 204, 204, 90]);
    expect(new Set(gapCents(12))).toEqual(new Set([90, 114]));
  });
});

describe('equal temperament', () => {
  it('divides the octave into equal steps', () => {
    const classes = equalTemperamentPitchClasses(12);

    expect(classes).toHaveLength(12);
    expect(classes[7].cents).toBe(700);
    expect(new Set(gapsBetween(classes).map((gap) => Math.round(gap.cents)))).toEqual(new Set([100]));
  });

  it('wraps: the 13th step is the first pitch class again', () => {
    expect(equalTemperamentPitchClass(12)).toEqual(equalTemperamentPitchClass(0));
    expect(equalTemperamentPitchClass(-1).id).toBe('12-tet:11');
  });
});

describe('notes', () => {
  const [α, β] = pythagoreanPitchClasses(2);

  it('keep pitch class and octave separate', () => {
    expect(noteLabel(note(α, 2))).toBe('α2');
    expect(note(β).octave).toBe(HOME_OCTAVE);
  });

  it('place octaves around the base: α0, α1, α2', () => {
    expect([0, 1, 2, 3].map((octave) => noteFrequency(note(α, octave)))).toEqual([100, 200, 400, 800]);
    expect(noteCents(note(α, 0))).toBe(-1200);
    expect(roundCents(noteCents(note(β, 2)))).toBe(1902);
  });

  it('follow the base frequency', () => {
    expect(noteFrequency(note(β), 100)).toBe(150);
  });
});
