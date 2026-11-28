/**
 * The number line demo: notes along a line, by cents or by hertz, optionally
 * revealed step by step and with the gaps between them labeled. Rebuilt from
 * six CodePen demos, which are now URL configurations of this one (see
 * `model.ts`).
 */

import { useState } from 'react';

import { colorForCents } from '../../music/colors';
import { CENTS_PER_OCTAVE } from '../../music/pitch';
import { DemoError } from '../DemoError';
import { DemoHeader } from '../DemoHeader';
import { useNotePlayer } from '../useNotePlayer';
import { NumberLine, type LineMark } from '../views/NumberLine';
import { configFromParams, frequencyOf, gapLabel, positionValue, stepCaption, valueLabel, visibleNotes } from './model';

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

  // The home octave, α1 up to α2, highlighted in α's color.
  const homeOctave = {
    from: scale === 'cents' ? 0 : 1,
    to: scale === 'cents' ? CENTS_PER_OCTAVE : 2,
    color: colorForCents(0).css,
    label: 'The home octave, from α1 to α2',
  };

  const marks: LineMark[] = shown.map((lineNote) => ({
    id: lineNote.id,
    label: lineNote.id,
    position: positionValue(lineNote, scale),
    value: valueLabel(lineNote, scale, tone.baseFrequency),
    color: lineNote.color,
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
        band={homeOctave}
        allPositions={positions}
        playingId={playing?.id}
        onActivate={playMark}
        label={description}
      />

      {error ? <DemoError error={error} /> : <p className="demo-status">Click a note to play it.</p>}
    </div>
  );
}
