/**
 * Pitch arithmetic: frequency ratios, cents, and octaves.
 *
 * Everything here is relative to a base frequency (by default α1 = 200 Hz),
 * so demos can follow the reader's chosen base tone. Pure functions only, so
 * it's all testable without a browser.
 */

/** The default base frequency: α1. High enough to sound on small speakers. */
export const DEFAULT_BASE_FREQUENCY = 200;

/** An octave is a frequency ratio of 2, which is 1200 cents. */
export const CENTS_PER_OCTAVE = 1200;

/** The size of a frequency ratio in cents: 1200 per doubling, logarithmic. */
export function ratioToCents(ratio: number): number {
  return CENTS_PER_OCTAVE * Math.log2(ratio);
}

export function centsToRatio(cents: number): number {
  return 2 ** (cents / CENTS_PER_OCTAVE);
}

/**
 * Split a ratio into a pitch class (a ratio in [1, 2), i.e. within one
 * octave) and the number of whole octaves above or below it.
 *
 *   foldIntoOctave(2.25) → { ratio: 1.125, octaves: 1 }   (γ, one octave up)
 *   foldIntoOctave(0.75) → { ratio: 1.5, octaves: -1 }    (β, one octave down)
 */
export function foldIntoOctave(ratio: number): { ratio: number; octaves: number } {
  const octaves = Math.floor(Math.log2(ratio));
  let folded = ratio / 2 ** octaves;

  // Guard against floating-point drift right at an octave boundary.
  if (folded >= 2) {
    return { ratio: folded / 2, octaves: octaves + 1 };
  }
  if (folded < 1) {
    folded *= 2;
    return { ratio: folded, octaves: octaves - 1 };
  }

  return { ratio: folded, octaves };
}

/** Wrap a cents value into one octave, [0, 1200). */
export function foldCents(cents: number): number {
  const wrapped = cents % CENTS_PER_OCTAVE;
  return wrapped < 0 ? wrapped + CENTS_PER_OCTAVE : wrapped;
}
