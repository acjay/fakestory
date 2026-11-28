/**
 * The number line's configuration and math, separate from its UI.
 *
 * Notes sit on a line, spaced either by cents (equal musical steps look equal)
 * or by hertz (each octave takes twice the room of the one below). The embed
 * URL says which notes to show:
 *
 *   ?notes=α0,β0,α1,β1,α2,β2    these notes, by name and octave
 *   ?notes=α1|β1|α2,γ2|γ1       a step-through: `|` separates steps
 *   ?fifths=5                   the first 5 pitch classes in the home octave, plus α2
 *   &captions=Start with α1.|…  what each step says, `|` between steps
 *   &scale=hertz                space by frequency instead of cents
 *   &gaps=1                     label the gap between neighboring notes
 */

import { colorForCents, type PitchColor } from '../../music/colors';
import { DEFAULT_BASE_FREQUENCY } from '../../music/pitch';
import { pythagoreanPitchClasses } from '../../music/pitchClasses';
import { HOME_OCTAVE, note, noteCents, noteLabel, noteRatio, parseNote, type Note } from '../../music/notes';

export type Scale = 'cents' | 'hertz';

export type LineNote = {
  /** The note's label, e.g. "γ2", which is also its identity on the line. */
  id: string;

  /** Which step it appears in (0 for notes shown from the start). */
  step: number;

  /** Ratio to the base frequency, including its octave. */
  ratio: number;

  /** Cents above the base frequency (negative below it). */
  cents: number;

  /** Colored by pitch class, so every γ has the same color in every octave. */
  color: PitchColor;
};

export type LineConfig = {
  notes: LineNote[];

  /** How many steps there are: 1 unless the URL sets up a step-through. */
  stepCount: number;

  /** The author's text for each step, if given; empty where it's missing. */
  captions: string[];

  scale: Scale;
  showGaps: boolean;
};

export const MIN_FIFTHS = 1;

/** Twelve notes is as many as fit legibly on one line. */
export const MAX_FIFTHS = 12;

/** Without parameters: the α and β notes over three octaves, by cents. */
export const DEFAULT_NOTES = 'α0,β0,α1,β1,α2,β2';

/** Read the configuration from the embed URL, falling back to defaults for anything missing or invalid. */
export function configFromParams(params: URLSearchParams): LineConfig {
  const scale: Scale = params.get('scale') === 'hertz' ? 'hertz' : 'cents';
  const showGaps = params.get('gaps') === '1';

  const fromNotes = params.has('notes') ? notesFromSteps(params.get('notes') ?? '') : [];
  const fifths = Number(params.get('fifths'));
  const fromFifths =
    Number.isInteger(fifths) && fifths >= MIN_FIFTHS && fifths <= MAX_FIFTHS ? notesFromFifths(fifths) : [];

  const notes = fromNotes.length > 0 ? fromNotes : fromFifths.length > 0 ? fromFifths : notesFromSteps(DEFAULT_NOTES);
  const stepCount = Math.max(...notes.map((lineNote) => lineNote.step)) + 1;
  const captions = (params.get('captions') ?? '').split('|').map((caption) => caption.trim());

  return { notes, stepCount, captions, scale, showGaps };
}

/**
 * Notes from a list like "α1|β1|α2,γ2|γ1": commas separate notes, `|`
 * separates steps. Unknown names and repeated notes are skipped, and so are
 * steps left empty by that.
 */
export function notesFromSteps(text: string): LineNote[] {
  const seen = new Set<string>();
  const notes: LineNote[] = [];
  let step = 0;

  for (const group of text.split('|')) {
    let added = false;

    for (const token of group.split(',')) {
      const parsed = parseNote(token.trim());
      if (parsed && !seen.has(noteLabel(parsed))) {
        seen.add(noteLabel(parsed));
        notes.push(lineNote(parsed, step));
        added = true;
      }
    }

    if (added) {
      step++;
    }
  }

  return notes;
}

/** The first `count` pitch classes, each a fifth above the last, folded into the home octave, plus α2 to close it. */
export function notesFromFifths(count: number): LineNote[] {
  const pitchClasses = pythagoreanPitchClasses(count);
  const notes = pitchClasses.map((pitchClass) => lineNote(note(pitchClass), 0));

  return [...notes, lineNote(note(pitchClasses[0], HOME_OCTAVE + 1), 0)];
}

function lineNote(n: Note, step: number): LineNote {
  return {
    id: noteLabel(n),
    step,
    ratio: noteRatio(n),
    cents: noteCents(n),
    color: colorForCents(n.pitchClass.cents),
  };
}

/** Where a note sits along the scale: cents, or a ratio for hertz (positions don't depend on the base). */
export function positionValue(lineNote: LineNote, scale: Scale): number {
  return scale === 'cents' ? lineNote.cents : lineNote.ratio;
}

export function frequencyOf(lineNote: LineNote, baseFrequency = DEFAULT_BASE_FREQUENCY): number {
  return baseFrequency * lineNote.ratio;
}

/** The value printed under a note: "702¢" or "300 Hz". */
export function valueLabel(lineNote: LineNote, scale: Scale, baseFrequency = DEFAULT_BASE_FREQUENCY): string {
  return scale === 'cents'
    ? `${Math.round(lineNote.cents)}¢`
    : `${formatHertz(frequencyOf(lineNote, baseFrequency))} Hz`;
}

/** The gap from one note up to the next: "+204¢" or "+25 Hz". */
export function gapLabel(from: LineNote, to: LineNote, scale: Scale, baseFrequency = DEFAULT_BASE_FREQUENCY): string {
  return scale === 'cents'
    ? `+${Math.round(to.cents - from.cents)}¢`
    : `+${formatHertz(frequencyOf(to, baseFrequency) - frequencyOf(from, baseFrequency))} Hz`;
}

/** Whole hertz where exact, otherwise one decimal: 300, 253.1. */
function formatHertz(hertz: number): string {
  const rounded = Math.round(hertz * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** The notes visible at a step, in order along the line. */
export function visibleNotes(config: LineConfig, step: number): LineNote[] {
  return config.notes
    .filter((lineNote) => lineNote.step <= step)
    .sort((a, b) => positionValue(a, config.scale) - positionValue(b, config.scale));
}

/**
 * What a step says, e.g. "Step 2 of 4: Add β1 702 cents above α1.": the
 * author's caption from the URL, or else which notes the step adds.
 */
export function stepCaption(config: LineConfig, step: number): string {
  const added = config.notes.filter((lineNote) => lineNote.step === step).map((lineNote) => lineNote.id);
  const text = config.captions[step] || `${step === 0 ? 'Start with' : 'Add'} ${added.join(' and ')}.`;

  return `Step ${step + 1} of ${config.stepCount}: ${text}`;
}
