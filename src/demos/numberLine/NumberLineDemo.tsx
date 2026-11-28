/**
 * The number line demo: notes along a line, by cents or by hertz, optionally
 * revealed step by step and with the gaps between them labeled. Rebuilt from
 * six CodePen demos, which are now URL configurations of this one (see
 * `model.ts`).
 */

import { useEffect, useRef, useState } from 'react';

import { colorForCents } from '../../music/colors';
import { CENTS_PER_OCTAVE } from '../../music/pitch';
import { DemoError } from '../DemoError';
import { DemoHeader } from '../DemoHeader';
import { useNotePlayer } from '../useNotePlayer';
import { useSlide } from '../useSlide';
import { NumberLine, type LineMark } from '../views/NumberLine';
import {
  arrivalsAt,
  configFromParams,
  frequencyOf,
  gapLabel,
  intervalLabel,
  positionValue,
  stepCaption,
  valueLabel,
  visibleNotes,
} from './model';

import '../demo.css';

export function NumberLineDemo({ params, title }: { params: URLSearchParams; title: string }) {
  const [config] = useState(() => configFromParams(params));
  const [step, setStep] = useState(0);
  const { tone, playing, error, play } = useNotePlayer();

  const { scale, stepCount } = config;
  const shown = visibleNotes(config, step);
  const isStepped = stepCount > 1;

  // Ends of the line fit every note, including ones still to come, so nothing moves as steps add notes.
  const positions = config.notes.map((lineNote) => positionValue(lineNote, scale));
  const domain: [number, number] = [Math.min(...positions), Math.max(...positions)];

  // Stepping forward, each new note slides out of the note it comes from,
  // its arc stretching and its interval counting up as it goes.
  const lastStep = useRef(step);
  const isForward = step > lastStep.current;
  useEffect(() => {
    lastStep.current = step;
  }, [step]);

  const arrivals = arrivalsAt(config, step);
  const longest = Math.max(0, ...arrivals.map((arrival) => Math.abs(arrival.cents)));
  const progress = useSlide(step, isForward && arrivals.length > 0, slideDuration(longest));
  const along = (from: number, to: number) => from + (to - from) * progress;

  const marks: LineMark[] = shown.map((lineNote) => {
    const arrival = arrivals.find((candidate) => candidate.note.id === lineNote.id);
    const position = positionValue(lineNote, scale);
    if (!arrival || progress === 1) {
      return {
        id: lineNote.id,
        label: lineNote.id,
        position,
        value: valueLabel(lineNote, scale, tone.baseFrequency),
        color: lineNote.color,
      };
    }

    // Partway: the note, and the value under it, between its source and its place.
    const value =
      scale === 'cents'
        ? `${Math.round(along(arrival.from.cents, lineNote.cents))}¢`
        : `${Math.round(along(frequencyOf(arrival.from, tone.baseFrequency), frequencyOf(lineNote, tone.baseFrequency)))} Hz`;

    return {
      id: lineNote.id,
      label: lineNote.id,
      position: along(positionValue(arrival.from, scale), position),
      value,
      color: lineNote.color,
      isMoving: true,
    };
  });

  // The home octave, α1 up to α2, highlighted in α's color from its step on.
  // If α1 or α2 is sliding into place in that step, the band's end goes with it.
  const homeEnds = scale === 'cents' ? [0, CENTS_PER_OCTAVE] : [1, 2];
  const endAt = (end: number) => {
    const sliding = marks.find(
      (mark) => mark.isMoving && arrivals.some((a) => a.note.id === mark.id && positionValue(a.note, scale) === end),
    );
    return sliding?.position ?? end;
  };
  const homeOctave =
    config.homeStep !== null && step >= config.homeStep
      ? {
          from: config.homeStep === step ? endAt(homeEnds[0]) : homeEnds[0],
          to: config.homeStep === step ? endAt(homeEnds[1]) : homeEnds[1],
          color: colorForCents(0).css,
          label: 'The home octave, from α1 to α2',
        }
      : undefined;

  const moves = arrivals.map((arrival) => ({
    id: arrival.note.id,
    from: positionValue(arrival.from, scale),
    to: along(positionValue(arrival.from, scale), positionValue(arrival.note, scale)),
    label: intervalLabel(arrival, scale, progress, tone.baseFrequency),
  }));
  const gaps = config.showGaps
    ? shown.slice(0, -1).map((lineNote, i) => gapLabel(lineNote, shown[i + 1], scale, tone.baseFrequency))
    : undefined;

  function playMark(mark: LineMark) {
    const lineNote = shown.find((candidate) => candidate.id === mark.id);
    if (lineNote) {
      void play(frequencyOf(lineNote, tone.baseFrequency), {
        id: mark.id,
        text: `Playing ${mark.label} (${mark.value})`,
      });
    }
  }

  const description =
    `Number line spaced by ${scale === 'cents' ? 'cents' : 'frequency'}, showing ` +
    shown.map((lineNote) => `${lineNote.id} at ${valueLabel(lineNote, scale, tone.baseFrequency)}`).join(', ') +
    (gaps ? `. Gaps: ${gaps.join(', ')}.` : '.');

  return (
    <div className="demo number-line-demo">
      <DemoHeader title={title} />

      {/* The step controls, with what the current step does. */}
      {isStepped && (
        <div className="number-line-steps">
          <div className="demo-stepper" role="group" aria-label="Steps">
            <button type="button" aria-label="Previous step" disabled={step === 0} onClick={() => setStep(step - 1)}>
              ←
            </button>
            <button
              type="button"
              aria-label="Next step"
              disabled={step === stepCount - 1}
              onClick={() => setStep(step + 1)}
            >
              →
            </button>
          </div>
          <output className="number-line-caption" aria-live="polite">
            {stepCaption(config, step)}
          </output>
        </div>
      )}

      <NumberLine
        marks={marks}
        domain={domain}
        gaps={gaps}
        moves={moves}
        reserveMoveSpace={isStepped}
        band={homeOctave}
        allPositions={positions}
        playingId={playing?.id}
        onActivate={playMark}
        label={description}
      />

      <DemoError error={error} />
    </div>
  );
}

/** Longer intervals take a little longer to slide, within comfortable bounds. */
function slideDuration(cents: number): number {
  return Math.min(1400, 500 + 0.4 * cents);
}
