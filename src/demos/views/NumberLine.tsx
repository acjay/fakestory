/**
 * The number line: notes placed along a line by cents or by hertz, with
 * optional arcs labeling the gap from each note to the next. Shared by the
 * demos that compare where notes fall.
 *
 * Notes are buttons (click, tap, or focus and press Enter/Space), drawn in
 * their pitch colors. Positions are fixed by `domain`, so notes don't move
 * when others appear, e.g. in a step-through.
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type RefObject } from 'react';

import type { PitchColor } from '../../music/colors';

export type LineMark = {
  id: string;
  label: string;

  /** Where it sits, in the same units as `domain`. */
  position: number;

  /** Printed under the line, e.g. "702¢". */
  value: string;

  color: PitchColor;

  /** Sliding into place: drawn on top of the notes it passes. */
  isMoving?: boolean;
};

type Props = {
  /** The notes to draw, in order along the line. */
  marks: LineMark[];

  /** The positions of the line's two ends. */
  domain: [number, number];

  /** Labels for the gap from each mark to the next, e.g. "+204¢"; one fewer than the marks. Omit for no arcs. */
  gaps?: string[];

  /**
   * Arcs from one position to another, labeled with the interval: how a
   * step-through's new notes got there. `to` can be partway, while a note
   * slides into place.
   */
  moves?: { id: string; from: number; to: number; label: string }[];

  /** Leave room under the line for `moves`, so it doesn't jump when they appear. */
  reserveMoveSpace?: boolean;

  /**
   * A stretch of the line to highlight, e.g. the home octave, in the line's
   * units, drawn as a thin band in `color` along the axis.
   */
  band?: { from: number; to: number; color: string; label: string };

  /**
   * Every position the line will ever show, including marks still to come in
   * a step-through. The line is made wide enough for the closest pair.
   */
  allPositions: number[];

  /** The note currently sounding, if any, drawn highlighted. */
  playingId?: string | null;

  onActivate?: (mark: LineMark) => void;

  /** Describes the whole line for screen readers. */
  label: string;
};

const MARK_RADIUS = 15;
const MARGIN = 40;
const LINE_Y = 72;

/** Where the line's arrowheads point to, from each edge, and their size. */
const AXIS_END = 4;
const ARROW_LENGTH = 14;
const ARROW_HALF_WIDTH = 7;

/** Half the height of the highlighted band along the line. */
const BAND_HALF_HEIGHT = 5;

/** The closest two marks may be, in pixels, before the line scrolls instead. */
const MIN_SPACING = 36;

/** Width of the line before it's measured (e.g. when rendered on the server). */
const DEFAULT_WIDTH = 600;

/** Roughly how wide a label is, in pixels, at the line's 12px text. */
const labelWidth = (text: string) => text.length * 6.5 + 2;

/** Lower rows for labels that would overlap their neighbor's, in pixels. */
const STAGGER = 14;

export function NumberLine({
  marks,
  domain,
  gaps,
  moves = [],
  reserveMoveSpace = false,
  band,
  allPositions,
  playingId = null,
  onActivate,
  label,
}: Props) {
  // An id for the arrowhead, unique to this line (useId's colons aren't valid in url()).
  const arrowId = `number-line-arrow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  // Drawn at the container's real width, so text stays full size on any
  // screen, but never so narrow that the closest marks overlap.
  const [containerRef, containerWidth] = useWidth();
  const [low, high] = domain;
  const span = high - low || 1;
  const width = Math.max(containerWidth, 2 * MARGIN + (span / closestGap(allPositions, span)) * MIN_SPACING);
  const x = (position: number) => MARGIN + ((position - low) / span) * (width - 2 * MARGIN);

  // Value labels that would run into the previous one drop to a second row.
  const valueRows = staggered(marks.map((mark) => ({ x: x(mark.position), width: labelWidth(mark.value) })));
  const gapRows = gaps
    ? staggered(
        gaps.map((gap, i) => ({ x: (x(marks[i].position) + x(marks[i + 1].position)) / 2, width: labelWidth(gap) })),
      )
    : [];

  const valuesBottom = LINE_Y + 20 + (valueRows.includes(1) ? STAGGER : 0);
  const arcTop = valuesBottom + 12;
  const hasArcs = Boolean(gaps) || moves.length > 0 || reserveMoveSpace;
  const height = hasArcs ? arcTop + 46 + (gapRows.includes(1) ? STAGGER : 0) : valuesBottom + 16;

  const activate = (mark: LineMark, event: MouseEvent | KeyboardEvent) => {
    event.preventDefault();
    onActivate?.(mark);
  };

  return (
    // Scrolls sideways on narrow screens rather than shrinking the labels past reading.
    <div className="number-line-scroll" ref={containerRef}>
      <svg
        className="number-line"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={label}
      >
        <defs>
          <marker id={arrowId} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" className="number-line-arrowhead" />
          </marker>
          <marker id={`${arrowId}-move`} markerWidth="9" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 9 3.5, 0 7" className="number-line-move-arrowhead" />
          </marker>
        </defs>

        {/* The highlighted stretch, e.g. the home octave, clipped to the line's ends. */}
        {band && (
          <rect
            className="number-line-band"
            x={x(Math.max(band.from, low))}
            y={LINE_Y - BAND_HALF_HEIGHT}
            width={Math.max(0, x(Math.min(band.to, high)) - x(Math.max(band.from, low)))}
            height={2 * BAND_HALF_HEIGHT}
            fill={band.color}
          >
            <title>{band.label}</title>
          </rect>
        )}

        {/* The line, with an arrowhead at each end: it carries on past the notes shown. */}
        <line
          className="number-line-axis"
          x1={AXIS_END + ARROW_LENGTH / 2}
          y1={LINE_Y}
          x2={width - AXIS_END - ARROW_LENGTH / 2}
          y2={LINE_Y}
        />
        <polygon
          className="number-line-axis-arrow"
          points={`${AXIS_END},${LINE_Y} ${AXIS_END + ARROW_LENGTH},${LINE_Y - ARROW_HALF_WIDTH} ${AXIS_END + ARROW_LENGTH},${LINE_Y + ARROW_HALF_WIDTH}`}
        />
        <polygon
          className="number-line-axis-arrow"
          points={`${width - AXIS_END},${LINE_Y} ${width - AXIS_END - ARROW_LENGTH},${LINE_Y - ARROW_HALF_WIDTH} ${width - AXIS_END - ARROW_LENGTH},${LINE_Y + ARROW_HALF_WIDTH}`}
        />

        {/* Gap arcs, from each note to the next, under the line. */}
        {gaps &&
          marks.slice(0, -1).map((mark, i) => {
            const from = x(mark.position) + 4;
            const to = x(marks[i + 1].position) - 4;
            const middle = (from + to) / 2;

            return (
              <g key={`gap-${mark.id}`} aria-hidden="true">
                <path
                  className="number-line-arc"
                  d={`M ${from},${arcTop} Q ${middle},${arcTop + 26} ${to},${arcTop}`}
                  markerEnd={`url(#${arrowId})`}
                />
                <text className="number-line-gap" x={middle} y={arcTop + 30 + gapRows[i] * STAGGER}>
                  {gaps[i]}
                </text>
              </g>
            );
          })}

        {/* Move arcs: from the note a new note came from, to where it is now. */}
        {moves.map((move) => {
          const direction = Math.sign(move.to - move.from);
          const from = x(move.from) + 4 * direction;
          const to = x(move.to) - 4 * direction;
          const middle = (from + to) / 2;

          // Too short to draw yet, at the very start of a slide.
          if (direction === 0 || (to - from) * direction < 8) {
            return null;
          }

          return (
            <g key={`move-${move.id}`} aria-hidden="true">
              <path
                className="number-line-move"
                d={`M ${from},${arcTop} Q ${middle},${arcTop + 26} ${to},${arcTop}`}
                markerEnd={`url(#${arrowId}-move)`}
              />
              <text className="number-line-move-label" x={middle} y={arcTop + 32}>
                {move.label}
              </text>
            </g>
          );
        })}

        {/* Notes, with any that are sliding drawn last, so they pass over the others. */}
        {drawingOrder(marks).map(({ mark, index: i }) => {
          const markX = x(mark.position);
          const markY = LINE_Y - 30;
          const isPlaying = mark.id === playingId;

          return (
            <g
              key={mark.id}
              className={`number-line-note${isPlaying ? ' number-line-note-playing' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`${mark.label}, ${mark.value.replace('¢', ' cents')}`}
              aria-pressed={isPlaying}
              onClick={(event) => activate(mark, event)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  activate(mark, event);
                }
              }}
            >
              <line className="number-line-tick" x1={markX} y1={LINE_Y - 6} x2={markX} y2={LINE_Y + 6} />
              {/* A ring pulsing out from the note while it sounds. */}
              {isPlaying && (
                <circle className="note-pulse" cx={markX} cy={markY} r={MARK_RADIUS} stroke={mark.color.css} />
              )}
              <circle className="number-line-focus" cx={markX} cy={markY} r={MARK_RADIUS + 4} />
              <circle cx={markX} cy={markY} r={MARK_RADIUS} fill={mark.color.css} />
              <text x={markX} y={markY} fill={mark.color.text} className="number-line-label">
                {mark.label}
              </text>
              <text x={markX} y={LINE_Y + 20 + valueRows[i] * STAGGER} className="number-line-value">
                {mark.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** The smallest distance between neighboring positions, but at least 1/40 of the span, so the line stays a sensible width. */
function closestGap(positions: number[], span: number): number {
  const sorted = [...new Set(positions)].sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((position, i) => position - sorted[i]);
  return Math.max(span / 40, Math.min(span, ...gaps));
}

/**
 * Rows for a run of labels, left to right: 0 normally, 1 for a label that
 * would overlap the one before it on row 0.
 */
function staggered(labels: { x: number; width: number }[]): number[] {
  const rows: number[] = [];
  let lastOnTop: { x: number; width: number } | null = null;

  for (const current of labels) {
    const overlaps = lastOnTop !== null && current.x - lastOnTop.x < (current.width + lastOnTop.width) / 2 + 4;
    rows.push(overlaps ? 1 : 0);
    if (!overlaps) {
      lastOnTop = current;
    }
  }

  return rows;
}

/** The width of an element, kept up to date as it resizes. */
function useWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/** The marks with their original indexes, moving ones last. */
function drawingOrder(marks: LineMark[]): { mark: LineMark; index: number }[] {
  const indexed = marks.map((mark, index) => ({ mark, index }));
  return [...indexed.filter(({ mark }) => !mark.isMoving), ...indexed.filter(({ mark }) => mark.isMoving)];
}
