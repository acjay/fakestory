/**
 * The scale generator: grow a scale by stacking fifths, and watch how evenly
 * its notes divide the octave. Rebuilt from the "ever-tightening circle"
 * CodePen on the shared engine, colors and octave circle.
 */

import { useEffect, useRef, useState } from 'react';

import { DemoHeader } from '../DemoHeader';
import { useNotePlayer } from '../useNotePlayer';
import { OctaveCircle, type CircleNote, type Modifiers } from '../views/OctaveCircle';
import {
  circleNotes,
  frequencyFor,
  MAX_SIZE,
  MIN_SIZE,
  OCTAVE_NAMES,
  octaveFor,
  sizeFromParams,
  statisticsTable,
  type OctaveChoice,
} from './model';

import '../demo.css';

export function ScaleGeneratorDemo({ params, title }: { params: URLSearchParams; title: string }) {
  const [size, setSize] = useState(() => sizeFromParams(params));
  const [octave, setOctave] = useState<OctaveChoice>(0);
  const { tone, playing, error, play } = useNotePlayer();

  const notes = circleNotes(size);
  const table = statisticsTable(size);

  // Keep the current size's row in view, scrolling only the table's own box.
  const tableScroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = tableScroll.current;
    const row = box?.querySelector<HTMLElement>('tr.is-current');
    if (box && row) {
      box.scrollTop = Math.max(0, row.offsetTop + row.offsetHeight - box.clientHeight);
    }
  }, [size]);

  // Played in the reader's shared tone, relative to its base frequency.
  function playNote(note: CircleNote, modifiers: Modifiers) {
    const playOctave = octaveFor(octave, modifiers);

    void play(frequencyFor(note.cents, playOctave, tone.baseFrequency), {
      id: note.id,
      text: `Playing ${note.label} (${Math.round(note.cents)}¢), ${OCTAVE_NAMES[playOctave].toLowerCase()} octave`,
    });
  }

  return (
    <div className="demo scale-generator">
      <DemoHeader title={title} />

      <div className="demo-toolbar scale-generator-toolbar">
        <div className="demo-stepper" role="group" aria-label="Scale size">
          <button
            type="button"
            aria-label="Remove the last note"
            disabled={size <= MIN_SIZE}
            onClick={() => setSize(size - 1)}
          >
            −
          </button>
          <output aria-live="polite">
            {size} {size === 1 ? 'note' : 'notes'}
          </output>
          <button
            type="button"
            aria-label="Add a fifth above the last note"
            disabled={size >= MAX_SIZE}
            onClick={() => setSize(size + 1)}
          >
            +
          </button>
        </div>

        <div className="demo-segmented" role="group" aria-label="Play notes in octave">
          <span className="demo-segmented-label">Octave</span>
          {([-1, 0, 1] as OctaveChoice[]).map((choice) => (
            <button key={choice} type="button" aria-pressed={octave === choice} onClick={() => setOctave(choice)}>
              {OCTAVE_NAMES[choice]}
            </button>
          ))}
        </div>
      </div>

      <p className={`demo-status${error ? ' demo-error' : ''}`} role="status">
        {error ??
          playing?.text ??
          'Select a note to hear it. Shortcuts: Shift for the octave above, Ctrl or ⌘ for below.'}
      </p>

      {/* The circle, with the table beside it where there's room, or below. */}
      <div className="scale-generator-body">
        <div className="scale-generator-circle">
          <OctaveCircle
            notes={notes}
            playingId={playing?.id}
            onActivate={playNote}
            label={`Octave circle with ${size} notes, each a fifth above the last, folded into one octave.`}
          />
        </div>

        <div className="scale-generator-statistics">
          <div className="demo-panel-head demo-rows-head">
            <strong>Gaps by scale size</strong>
            <span>in cents</span>
          </div>

          {/* Scrolls on its own once there are more sizes than fit beside the circle. */}
          <div className="scale-generator-table-scroll" ref={tableScroll}>
            <table className="scale-generator-table">
              <thead>
                <tr>
                  <th scope="col">Notes</th>
                  <th scope="col">Biggest gap</th>
                  <th scope="col">Smallest gap</th>
                  <th scope="col">Gap sizes</th>
                  <th scope="col">Std. dev.</th>
                </tr>
              </thead>
              <tbody>
                {table.map(({ size: rowSize, statistics }) => (
                  <tr
                    key={rowSize}
                    className={rowSize === size ? 'is-current' : undefined}
                    aria-current={rowSize === size || undefined}
                  >
                    <th scope="row">{rowSize}</th>
                    <td>{Math.round(statistics.biggest)}</td>
                    <td>{Math.round(statistics.smallest)}</td>
                    <td>{statistics.sizes}</td>
                    <td>{statistics.sizes > 1 ? Math.round(statistics.standardDeviation) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
