/**
 * Notes: a pitch class in a particular octave, like α2 or γ1.
 *
 * Octaves are numbered from the base: octave 1 is the home octave, starting
 * at α1 (the base frequency). α marks each octave boundary, so α0 is an octave
 * below the base and α2 an octave above.
 */

import { DEFAULT_BASE_FREQUENCY, ratioToCents } from './pitch';
import { GREEK_NAMES, pythagoreanPitchClasses, type PitchClass } from './pitchClasses';

/** The home octave, which contains the base frequency. */
export const HOME_OCTAVE = 1;

export type Note = {
  pitchClass: PitchClass;
  octave: number;
};

export function note(pitchClass: PitchClass, octave = HOME_OCTAVE): Note {
  return { pitchClass, octave };
}

/** E.g. "β1". Views that ignore octaves (like a circle) use `pitchClass.name`. */
export function noteLabel({ pitchClass, octave }: Note): string {
  return `${pitchClass.name}${octave}`;
}

/** The note's ratio to the base frequency, including its octave. */
export function noteRatio({ pitchClass, octave }: Note): number {
  return pitchClass.ratio * 2 ** (octave - HOME_OCTAVE);
}

/** Cents above the base frequency (negative below it). */
export function noteCents(n: Note): number {
  return ratioToCents(noteRatio(n));
}

export function noteFrequency(n: Note, baseFrequency = DEFAULT_BASE_FREQUENCY): number {
  return baseFrequency * noteRatio(n);
}

/**
 * A note from its name, e.g. "γ2": a Greek letter for the pitch class (its
 * place in the stack of fifths), then the octave. Used by demo URLs. Returns
 * null for anything else.
 */
export function parseNote(name: string): Note | null {
  const match = name.match(/^(\p{Script=Greek})(-?\d+)$/u);
  const index = match ? GREEK_NAMES.indexOf(match[1]) : -1;
  if (!match || index === -1) {
    return null;
  }

  const pitchClass = pythagoreanPitchClasses(index + 1)[index];
  return note(pitchClass, Number(match[2]));
}
