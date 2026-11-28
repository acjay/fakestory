/**
 * The number line's configuration and math, separate from its UI.
 *
 * Notes sit on a line, spaced either by cents (equal musical steps look equal)
 * or by hertz (each octave takes twice the room of the one below). The embed
 * URL says which notes to show:
 *
 *   ?notes=α0,β0,α1,β1,α2,β2    these notes, by name and octave
 *   ?notes=α1|β1|α2,γ2|γ1       a step-through: `|` separates steps
 *   ?notes=α1|α2,home|β1        `home` highlights the home octave, α1 to α2, from its step on
 *   ?fifths=5                   the first 5 pitch classes in the home octave, plus α2
 *   &captions=Start with α1.|…  what each step says, `|` between steps
 *   &scale=hertz                space by frequency instead of cents
 *   &gaps=1                     label the gap between neighboring notes
 */

import { colorForCents, type PitchColor } from '../../music/colors';
import { CENTS_PER_OCTAVE, DEFAULT_BASE_FREQUENCY, ratioToCents } from '../../music/pitch';
import { PERFECT_FIFTH, pythagoreanPitchClasses } from '../../music/pitchClasses';
import { HOME_OCTAVE, note, noteCents, noteLabel, noteRatio, parseNote, type Note } from '../../music/notes';

/** A perfect fifth, about 702 cents. */
const FIFTH_CENTS = ratioToCents(PERFECT_FIFTH);

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

  /** Its place in the stack of fifths: α is 0, β is 1, γ is 2, and so on. */
  fifths: number;

  /** Colored by pitch class, so every γ has the same color in every octave. */
  color: PitchColor;
};

export type LineConfig = {
  notes: LineNote[];

  /** How many steps there are: 1 unless the URL sets up a step-through. */
  stepCount: number;

  /** The author's text for each step, if given; empty where it's missing. */
  captions: string[];

  /** The step from which the home octave (α1 to α2) is highlighted, or null for none. */
  homeStep: number | null;

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

  const fromNotes = params.has('notes') ? parseSteps(params.get('notes') ?? '') : { notes: [], homeStep: null };
  const fifths = Number(params.get('fifths'));
  const fromFifths =
    Number.isInteger(fifths) && fifths >= MIN_FIFTHS && fifths <= MAX_FIFTHS ? notesFromFifths(fifths) : [];

  const chosen =
    fromNotes.notes.length > 0
      ? fromNotes
      : fromFifths.length > 0
        ? { notes: fromFifths, homeStep: null }
        : parseSteps(DEFAULT_NOTES);
  const { notes, homeStep } = chosen;
  const stepCount = Math.max(homeStep ?? 0, ...notes.map((lineNote) => lineNote.step)) + 1;
  const captions = (params.get('captions') ?? '').split('|').map((caption) => caption.trim());

  return { notes, stepCount, captions, homeStep, scale, showGaps };
}

/**
 * Notes from a list like "α1|β1|α2,γ2|γ1": commas separate notes, `|`
 * separates steps. Unknown names and repeated notes are skipped, and so are
 * steps left empty by that.
 */
export function notesFromSteps(text: string): LineNote[] {
  return parseSteps(text).notes;
}

/** The word in `notes` that highlights the home octave from its step on. */
export const HOME_OCTAVE_TOKEN = 'home';

/** Notes and the home octave's step from a `notes` list, e.g. "α1|α2,home|β1". */
export function parseSteps(text: string): { notes: LineNote[]; homeStep: number | null } {
  const seen = new Set<string>();
  const notes: LineNote[] = [];
  let homeStep: number | null = null;
  let step = 0;

  for (const group of text.split('|')) {
    let added = false;

    for (const token of group.split(',').map((part) => part.trim())) {
      if (token === HOME_OCTAVE_TOKEN && homeStep === null) {
        homeStep = step;
        added = true;
        continue;
      }

      const parsed = parseNote(token);
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

  return { notes, homeStep };
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
    fifths: n.pitchClass.index,
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
  const fallback =
    added.length > 0
      ? `${step === 0 ? 'Start with' : 'Add'} ${added.join(' and ')}.`
      : 'Highlight the home octave, from α1 to α2.';
  const text = config.captions[step] || fallback;

  return `Step ${step + 1} of ${config.stepCount}: ${text}`;
}

/** A note a step adds, and the note on the line it comes from. */
export type Arrival = {
  note: LineNote;
  from: LineNote;

  /** The interval from `from` up (or down, if negative) to `note`, in cents. */
  cents: number;
};

/** Tolerance for comparing intervals in cents, against floating-point drift. */
const CENTS_TOLERANCE = 0.01;

/**
 * Where each note a step adds comes from, so it can slide out of that note:
 * a note already on the line a fifth away (the neighboring Greek letter),
 * or else an octave away (the same letter). The latest such note wins.
 * Notes that come from neither just appear.
 *
 *   α1 | α2 | β1 | γ2 | γ1   →   α2 from α1, β1 from α1, γ2 from β1, γ1 from γ2
 */
export function arrivalsAt(config: LineConfig, step: number): Arrival[] {
  const earlier = config.notes.filter((lineNote) => lineNote.step < step).reverse();
  const isNear = (a: number, b: number) => Math.abs(a - b) < CENTS_TOLERANCE;

  return config.notes
    .filter((lineNote) => lineNote.step === step && step > 0)
    .flatMap((lineNote) => {
      const byFifth = earlier.find(
        (candidate) =>
          Math.abs(candidate.fifths - lineNote.fifths) === 1 &&
          isNear(Math.abs(lineNote.cents - candidate.cents), FIFTH_CENTS) &&
          Math.sign(lineNote.cents - candidate.cents) === Math.sign(lineNote.fifths - candidate.fifths),
      );
      const byOctave = earlier.find(
        (candidate) =>
          candidate.fifths === lineNote.fifths && isNear(Math.abs(lineNote.cents - candidate.cents), CENTS_PER_OCTAVE),
      );
      const from = byFifth ?? byOctave;

      return from ? [{ note: lineNote, from, cents: lineNote.cents - from.cents }] : [];
    });
}

/** An interval's label, partway through sliding (`progress` from 0 to 1): "+702¢", "−1200¢" or "+100 Hz". */
export function intervalLabel(
  arrival: Arrival,
  scale: Scale,
  progress = 1,
  baseFrequency = DEFAULT_BASE_FREQUENCY,
): string {
  const size =
    scale === 'cents'
      ? arrival.cents
      : frequencyOf(arrival.note, baseFrequency) - frequencyOf(arrival.from, baseFrequency);
  const sofar = Math.round(Math.abs(size) * progress);

  return `${size < 0 ? '−' : '+'}${sofar}${scale === 'cents' ? '¢' : ' Hz'}`;
}

/**
 * What a step plays as it slides its notes in: the notes they come from,
 * then the new notes as they land. New notes with nowhere to come from
 * play with the others; a step of those alone plays them straight away.
 */
export function stepSounds(config: LineConfig, step: number): { first: LineNote[]; then: LineNote[] } {
  const added = config.notes.filter((lineNote) => lineNote.step === step);
  const sources = arrivalsAt(config, step).map((arrival) => arrival.from);
  const first = sources.filter((source, i) => sources.findIndex((other) => other.id === source.id) === i);

  return first.length > 0 ? { first, then: added } : { first: added, then: [] };
}
