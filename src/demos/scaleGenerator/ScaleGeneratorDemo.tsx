/**
 * The scale generator: grow a scale by stacking fifths, and watch how evenly
 * its notes divide the octave. Rebuilt from the "ever-tightening circle"
 * CodePen on the shared engine, colors and octave circle.
 */

import { useState } from 'react';

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

      <div className="scale-generator-circle">
        <OctaveCircle
          notes={notes}
          playingId={playing?.id}
          onActivate={playNote}
          label={`Octave circle with ${size} notes, each a fifth above the last, folded into one octave.`}
        />
      </div>

      <div className="demo-panel-head demo-rows-head">
        <strong>Gaps by scale size</strong>
        <span>in cents</span>
      </div>

      {table.map((group) => (
        <div key={group[0].size} className="demo-table-scroll">
          <table className="scale-generator-table">
            <thead>
              <tr>
                <th scope="row">Notes</th>
                {group.map(({ size: columnSize }) => (
                  <th key={columnSize} scope="col" aria-current={columnSize === size || undefined}>
                    {columnSize}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <StatisticRow label="Biggest gap" group={group} size={size} value={(s) => Math.round(s.biggest)} />
              <StatisticRow label="Smallest gap" group={group} size={size} value={(s) => Math.round(s.smallest)} />
              <StatisticRow label="Gap sizes" group={group} size={size} value={(s) => s.sizes} />
              <StatisticRow
                label="Std. deviation"
                group={group}
                size={size}
                value={(s) => (s.sizes > 1 ? Math.round(s.standardDeviation) : '–')}
              />
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

type Group = ReturnType<typeof statisticsTable>[number];

function StatisticRow({
  label,
  group,
  size,
  value,
}: {
  label: string;
  group: Group;
  size: number;
  value: (statistics: Group[number]['statistics']) => string | number;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      {group.map(({ size: columnSize, statistics }) => (
        <td key={columnSize} className={columnSize === size ? 'is-current' : undefined}>
          {value(statistics)}
        </td>
      ))}
    </tr>
  );
}
