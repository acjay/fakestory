/**
 * Note buttons: one or more buttons, each playing a note or a few notes
 * together, in the reader's tone. Rebuilt from four CodePen demos (the base
 * tone, an octave up and down, and two-note harmonies), which are now URL
 * configurations of this one (see `model.ts`).
 */

import { useState } from 'react';

import { DemoError } from '../DemoError';
import { DemoHeader } from '../DemoHeader';
import { useNotePlayer } from '../useNotePlayer';
import { buttonsFromParams, frequenciesOf, hertzLabel, type NoteButton } from './model';

import '../demo.css';

export function NoteButtonsDemo({ params, title }: { params: URLSearchParams; title: string }) {
  const [buttons] = useState(() => buttonsFromParams(params));
  const { tone, playing, error, play } = useNotePlayer();

  function playButton(button: NoteButton) {
    const hertz = hertzLabel(button, tone.baseFrequency);
    void play(frequenciesOf(button, tone.baseFrequency), {
      id: button.label,
      text: `Playing ${button.label} (${hertz})`,
    });
  }

  return (
    <div className="demo note-buttons-demo">
      <DemoHeader title={title} />

      <div className="note-buttons">
        {buttons.map((button) => {
          const hertz = hertzLabel(button, tone.baseFrequency);
          const names = button.notes.map((n) => n.name);
          const spoken =
            names.length === 1
              ? `Play ${names[0]}, ${hertz.replace('Hz', 'hertz')}`
              : `Play ${names.join(' and ')} together, ${hertz.replace(' + ', ' and ').replace('Hz', 'hertz')}`;

          return (
            <button
              key={button.label}
              type="button"
              className={`note-button${playing?.id === button.label ? ' is-sounding' : ''}`}
              aria-label={spoken}
              aria-pressed={playing?.id === button.label}
              onClick={() => playButton(button)}
            >
              <span className="note-button-names">
                {button.notes.map((n, i) => (
                  <span key={n.name} className="note-button-note">
                    {i > 0 && <span className="note-button-and"> & </span>}
                    <span
                      className="note-button-swatch"
                      style={{ background: n.color.css, color: n.color.text }}
                      aria-hidden="true"
                    >
                      {n.name}
                    </span>
                  </span>
                ))}
              </span>
              <span className="note-button-hertz">{hertz}</span>
            </button>
          );
        })}
      </div>

      <DemoError error={error} />
    </div>
  );
}
