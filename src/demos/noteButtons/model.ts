/**
 * The note buttons' configuration, separate from their UI.
 *
 * Each button plays a note, or several notes together. The embed URL lists
 * them, by name and octave:
 *
 *   ?buttons=α1            one button: α1
 *   ?buttons=α1,γ1|α1,β1   two buttons, each playing two notes together
 *
 * `|` separates buttons; `,` joins the notes one button plays.
 */

import { colorForCents, type PitchColor } from '../../music/colors';
import { DEFAULT_BASE_FREQUENCY } from '../../music/pitch';
import { noteFrequency, noteLabel, parseNote, type Note } from '../../music/notes';

export type NoteButton = {
  /** E.g. "α1" or "α1 & γ1", which is also the button's identity. */
  label: string;

  notes: { name: string; note: Note; color: PitchColor }[];
};

/** Without parameters: one button for the base tone, α1. */
export const DEFAULT_BUTTONS = 'α1';

/** The buttons from the embed URL. Unknown note names are skipped, and so are buttons left empty. */
export function buttonsFromParams(params: URLSearchParams): NoteButton[] {
  const buttons = parseButtons(params.get('buttons') ?? '');
  return buttons.length > 0 ? buttons : parseButtons(DEFAULT_BUTTONS);
}

function parseButtons(text: string): NoteButton[] {
  return text
    .split('|')
    .map((group) =>
      group
        .split(',')
        .map((name) => parseNote(name.trim()))
        .filter((parsed): parsed is Note => parsed !== null)
        .map((parsed) => ({ name: noteLabel(parsed), note: parsed, color: colorForCents(parsed.pitchClass.cents) })),
    )
    .filter((notes) => notes.length > 0)
    .map((notes) => ({ label: notes.map((n) => n.name).join(' & '), notes }));
}

export function frequenciesOf(button: NoteButton, baseFrequency = DEFAULT_BASE_FREQUENCY): number[] {
  return button.notes.map((n) => noteFrequency(n.note, baseFrequency));
}

/** "200 Hz", or "200 + 225 Hz" for notes played together. */
export function hertzLabel(button: NoteButton, baseFrequency = DEFAULT_BASE_FREQUENCY): string {
  const hertz = frequenciesOf(button, baseFrequency).map((frequency) => {
    const rounded = Math.round(frequency * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  });
  return `${hertz.join(' + ')} Hz`;
}
