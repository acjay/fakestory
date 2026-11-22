/**
 * The octave circle: pitch classes placed around a circle by their cents
 * above α (at the top), so the octave wraps around on itself. Shared by the
 * demos that show how notes divide the octave.
 *
 * Notes are buttons (click, tap, or focus and press Enter/Space), drawn in
 * their pitch colors. Modifier keys are passed along, so demos can offer
 * shortcuts like Shift for an octave up.
 */

import type { KeyboardEvent, MouseEvent } from 'react';

import type { PitchColor } from '../../music/colors';
import { CENTS_PER_OCTAVE } from '../../music/pitch';

export type CircleNote = {
  id: string;
  label: string;
  cents: number;
  color: PitchColor;
};

export type Modifiers = { shift: boolean; down: boolean };

type Props = {
  notes: CircleNote[];

  /** Label each gap between neighboring notes with its size in cents. */
  showGaps?: boolean;

  /** The note currently sounding, if any, drawn highlighted. */
  playingId?: string | null;

  onActivate?: (note: CircleNote, modifiers: Modifiers) => void;

  /** Describes the whole circle for screen readers. */
  label: string;
};

const SIZE = 400;
const CENTER = SIZE / 2;
const RADIUS = 140;
const PADDING = 24;

/** Past this many notes, gap labels would crowd; the demos show gaps another way. */
const MAX_GAP_LABELS = 24;

/** Gaps smaller than this alternate between two label rings so they don't overlap. */
const NARROW_GAP_CENTS = 60;

export function OctaveCircle({ notes, showGaps = true, playingId = null, onActivate, label }: Props) {
  const sorted = [...notes].sort((a, b) => a.cents - b.cents);

  // Smaller marks as the circle fills up, within readable bounds.
  const markRadius = Math.max(10, Math.min(20, (Math.PI * RADIUS) / Math.max(1, sorted.length) / 1.25));
  const fontSize = Math.max(10, Math.min(16, markRadius * 0.85));

  const activate = (note: CircleNote, event: MouseEvent | KeyboardEvent) =>
    onActivate?.(note, { shift: event.shiftKey, down: event.ctrlKey || event.metaKey });

  // Notes closer than a mark's width (e.g. a comma apart) would overlap, so
  // each note goes on the first ring, outermost first, where it clears the
  // last note placed there. Inner rings sit at the same angle, joined to
  // the circle by a short line.
  const ringRadii = [RADIUS, RADIUS - 2 * markRadius - 6, RADIUS - 4 * markRadius - 12];
  const lastOnRing: (number | null)[] = ringRadii.map(() => null);
  const firstOnRing: (number | null)[] = ringRadii.map(() => null);
  const ringOf = new Map<string, number>();
  for (const note of sorted) {
    // Check the previous note on the ring, and the first one, an octave
    // around (where the circle closes, back at α).
    const clears = (ring: number) => {
      const arc = (cents: number | null) =>
        cents === null ? Infinity : (Math.abs(cents) / CENTS_PER_OCTAVE) * 2 * Math.PI * ringRadii[ring];
      const last = lastOnRing[ring];
      const first = firstOnRing[ring];
      const minimum = 2 * markRadius + 2;
      return (
        arc(last === null ? null : note.cents - last) >= minimum &&
        arc(first === null ? null : first + CENTS_PER_OCTAVE - note.cents) >= minimum
      );
    };
    const ring = ringRadii.findIndex((_, i) => clears(i));
    const chosen = ring === -1 ? ringRadii.length - 1 : ring;
    ringOf.set(note.id, chosen);
    lastOnRing[chosen] = note.cents;
    firstOnRing[chosen] ??= note.cents;
  }

  let narrowRun = 0;

  return (
    // Padded so the outer ring of gap labels never clips.
    <svg
      className="octave-circle"
      viewBox={`${-PADDING} ${-PADDING} ${SIZE + 2 * PADDING} ${SIZE + 2 * PADDING}`}
      role="group"
      aria-label={label}
    >
      <circle className="octave-circle-ring" cx={CENTER} cy={CENTER} r={RADIUS} />

      {/* Gap labels, between each note and the next one around the circle. */}
      {showGaps &&
        sorted.length > 1 &&
        sorted.length <= MAX_GAP_LABELS &&
        sorted.map((note, i) => {
          const next = sorted[(i + 1) % sorted.length];
          const gap = (next.cents - note.cents + CENTS_PER_OCTAVE) % CENTS_PER_OCTAVE || CENTS_PER_OCTAVE;

          // Alternate rings for runs of narrow gaps.
          narrowRun = gap < NARROW_GAP_CENTS ? narrowRun + 1 : 0;
          const ring = RADIUS + markRadius + (narrowRun % 2 === 0 ? 16 : 32);
          const [x, y] = position(note.cents + gap / 2, ring);

          return (
            <text key={`gap-${note.id}`} className="octave-circle-gap" x={x} y={y} aria-hidden="true">
              +{Math.round(gap)}¢
            </text>
          );
        })}

      {sorted.map((note) => {
        const ring = ringOf.get(note.id) ?? 0;
        const isInward = ring > 0;
        const [x, y] = position(note.cents, ringRadii[ring]);
        const [ringX, ringY] = position(note.cents, RADIUS);
        const isPlaying = note.id === playingId;
        const name = `${note.label}, ${Math.round(note.cents)} cents`;

        return (
          <g
            key={note.id}
            className={`octave-circle-note${isPlaying ? ' octave-circle-note-playing' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={name}
            aria-pressed={isPlaying}
            onClick={(event) => activate(note, event)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activate(note, event);
              }
            }}
          >
            {isInward && <line className="octave-circle-tick" x1={ringX} y1={ringY} x2={x} y2={y} />}
            <circle className="octave-circle-focus" cx={x} cy={y} r={markRadius + 4} />
            <circle cx={x} cy={y} r={markRadius} fill={note.color.css} />
            <text x={x} y={y} fill={note.color.text} fontSize={fontSize} className="octave-circle-label">
              {note.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Where a pitch sits: α at the top, going clockwise. */
function position(cents: number, radius: number): [number, number] {
  const angle = (cents / CENTS_PER_OCTAVE) * 2 * Math.PI - Math.PI / 2;
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
}
