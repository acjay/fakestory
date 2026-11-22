/**
 * The scale generator's state and math, separate from its UI.
 *
 * The reader grows a scale one fifth at a time: each new note is a fifth
 * above the last, folded back into the octave. The circle shows the notes;
 * the table shows, for every size so far, how evenly they divide the octave.
 */

import { colorForCents } from '../../music/colors';
import { DEFAULT_BASE_FREQUENCY } from '../../music/pitch';
import { gapStatistics, pythagoreanPitchClasses, type GapStatistics } from '../../music/pitchClasses';
import type { CircleNote } from '../views/OctaveCircle';

export const MIN_SIZE = 1;

/** 53 notes is the next very even stopping point after 12. */
export const MAX_SIZE = 53;

export const DEFAULT_SIZE = 12;

/** The table shows this many scale sizes per row group, so it fits narrow screens. */
export const TABLE_GROUP = 12;

/** Which octave a note is played in, relative to the home octave (α1 = the base frequency). */
export type OctaveChoice = -1 | 0 | 1;

/**
 * Starting size from the embed URL: `?size=7` starts with seven notes.
 * Missing or invalid values fall back to 12.
 */
export function sizeFromParams(params: URLSearchParams): number {
  const size = Number(params.get('size'));
  return Number.isInteger(size) && size >= MIN_SIZE && size <= MAX_SIZE ? size : DEFAULT_SIZE;
}

/** The notes for a scale of `size`, ready for the octave circle. */
export function circleNotes(size: number): CircleNote[] {
  return pythagoreanPitchClasses(size).map((pitchClass) => ({
    id: pitchClass.id,
    label: pitchClass.name,
    cents: pitchClass.cents,
    color: colorForCents(pitchClass.cents),
  }));
}

/** Gap statistics for every scale size from 1 to `size`, in table groups. */
export function statisticsTable(size: number): { size: number; statistics: GapStatistics }[][] {
  const rows = Array.from({ length: size }, (_, i) => ({
    size: i + 1,
    statistics: gapStatistics(pythagoreanPitchClasses(i + 1)),
  }));

  const groups = [];
  for (let start = 0; start < rows.length; start += TABLE_GROUP) {
    groups.push(rows.slice(start, start + TABLE_GROUP));
  }
  return groups;
}

/** A note's frequency in the chosen octave. */
export function frequencyFor(cents: number, octave: OctaveChoice, baseFrequency = DEFAULT_BASE_FREQUENCY): number {
  return baseFrequency * 2 ** (cents / 1200 + octave);
}

/**
 * Which octave a click plays: Shift for one above, Ctrl/⌘ for one below,
 * otherwise the octave chosen on screen.
 */
export function octaveFor(chosen: OctaveChoice, modifiers: { shift: boolean; down: boolean }): OctaveChoice {
  if (modifiers.shift) return 1;
  if (modifiers.down) return -1;
  return chosen;
}

export const OCTAVE_NAMES: Record<OctaveChoice, string> = { [-1]: 'Below', 0: 'Home', 1: 'Above' };
