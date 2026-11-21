/**
 * Pitch classes and the collections they come in.
 *
 * A pitch class is a note without its octave: α, rather than α0, α1 or α2.
 * A collection is a set of pitch classes built from a generator interval:
 *
 *   - Pythagorean: stack 3:2 fifths. It never closes: the 13th fifth lands
 *     about 24 cents (the Pythagorean comma) past where it started.
 *   - Equal temperament: stack equal steps. It closes: after `divisions`
 *     steps it wraps back to the first pitch class.
 *
 * Octaves are kept separate (see `notes.ts`), following the demo design model.
 */

import { CENTS_PER_OCTAVE, foldIntoOctave, ratioToCents } from './pitch';

export type PitchClass = {
  /** Stable identifier, e.g. "pythagorean:2" or "12-tet:7". */
  id: string;

  /** Display name without an octave, e.g. "γ" or "7". */
  name: string;

  /** How many generator steps from the first pitch class (α is 0). */
  index: number;

  /** Frequency ratio above the base, within one octave: [1, 2). */
  ratio: number;

  /** The same, in cents: [0, 1200). */
  cents: number;
};

/** A perfect fifth: the "happy interval". */
export const PERFECT_FIFTH = 3 / 2;

/**
 * Names for Pythagorean pitch classes, in stacking order: α is the base, β is
 * one fifth up, γ two, and so on. Beyond these, pitch classes are numbered.
 */
export const GREEK_NAMES = [
  'α',
  'β',
  'γ',
  'δ',
  'ε',
  'ζ',
  'η',
  'θ',
  'ι',
  'κ',
  'λ',
  'μ',
  'ν',
  'ξ',
  'ο',
  'π',
  'ρ',
  'σ',
  'τ',
  'υ',
  'φ',
  'χ',
  'ψ',
  'ω',
];

/** The size of the Pythagorean comma: twelve fifths minus seven octaves, about 23.46¢. */
export const PYTHAGOREAN_COMMA_CENTS = 12 * ratioToCents(PERFECT_FIFTH) - 7 * CENTS_PER_OCTAVE;

/**
 * The first `count` Pythagorean pitch classes, in the order they're
 * generated: each is a fifth above the previous one, folded into one octave.
 */
export function pythagoreanPitchClasses(count: number): PitchClass[] {
  return Array.from({ length: count }, (_, index) => {
    const { ratio } = foldIntoOctave(PERFECT_FIFTH ** index);

    return {
      id: `pythagorean:${index}`,
      name: GREEK_NAMES[index] ?? String(index + 1),
      index,
      ratio,
      cents: ratioToCents(ratio),
    };
  });
}

/**
 * Equal temperament: the octave divided into `divisions` equal steps. Step
 * indexes wrap, so step `divisions` is the same pitch class as step 0.
 */
export function equalTemperamentPitchClass(step: number, divisions = 12): PitchClass {
  const index = ((step % divisions) + divisions) % divisions;
  const cents = (index * CENTS_PER_OCTAVE) / divisions;

  return {
    id: `${divisions}-tet:${index}`,
    name: String(index),
    index,
    ratio: 2 ** (index / divisions),
    cents,
  };
}

export function equalTemperamentPitchClasses(divisions = 12): PitchClass[] {
  return Array.from({ length: divisions }, (_, step) => equalTemperamentPitchClass(step, divisions));
}

/**
 * The gap from each pitch class up to the next one within the octave, in
 * ascending order, including the gap from the highest back up to the first
 * (an octave above). The gaps always add up to 1200 cents.
 */
export function gapsBetween(pitchClasses: PitchClass[]): { from: PitchClass; cents: number }[] {
  const sorted = [...pitchClasses].sort((a, b) => a.cents - b.cents);

  return sorted.map((from, i) => {
    const nextCents = i + 1 < sorted.length ? sorted[i + 1].cents : sorted[0].cents + CENTS_PER_OCTAVE;
    return { from, cents: nextCents - from.cents };
  });
}
