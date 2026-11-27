/**
 * The tone settings button every demo shows: a small ♪ in the demo's upper
 * right corner, which opens a panel to change or reset the shared tone. Its
 * tooltip and accessible name summarize the current tone. Changes apply to
 * every demo at once (see toneSettings.ts).
 *
 * Render it as the demo's first element: it floats right, so the demo's
 * first row of controls makes room for it.
 */

import { usePopup } from '../usePopup';

import { DEFAULT_TONE, TONE_LIMITS, toneStore } from '../audio/toneSettings';
import { PROFILE_LABELS, type HarmonicProfile } from '../audio/voices';
import { NumberField } from './NumberField';
import { useToneSettings } from './useToneSettings';

/** Short names for the button summary. */
const PROFILE_NAMES: Record<HarmonicProfile, string> = { sawtooth: 'sawtooth', square: 'square', triangle: 'triangle' };

export function ToneSettingsControl() {
  const tone = useToneSettings();
  // Closes on Escape or a click outside, like the story's footnotes.
  const { open, setOpen, toggle, containerRef, popupId: id } = usePopup<HTMLDivElement>();
  const store = toneStore();

  const isDefault =
    tone.baseFrequency === DEFAULT_TONE.baseFrequency &&
    tone.profile === DEFAULT_TONE.profile &&
    tone.partials === DEFAULT_TONE.partials;

  const summary = `Tone settings: ${tone.baseFrequency} Hz, ${PROFILE_NAMES[tone.profile]}`;

  return (
    <div className="tone-settings" ref={containerRef}>
      <button
        type="button"
        className="tone-settings-button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-label={summary}
        title={summary}
        onClick={toggle}
      >
        <span aria-hidden="true">♪</span>
      </button>

      {open && (
        <div id={`${id}-panel`} className="tone-settings-panel demo-panel" role="group" aria-label="Tone settings">
          <div className="demo-field">
            <div className="demo-field-label">
              <label htmlFor={`${id}-base`}>Base frequency (α1)</label>
              <span className="demo-number">
                <NumberField
                  min={TONE_LIMITS.minFrequency}
                  max={TONE_LIMITS.maxFrequency}
                  value={tone.baseFrequency}
                  aria-label="Base frequency in hertz"
                  onChange={(baseFrequency) => store.set({ baseFrequency })}
                />
                Hz
              </span>
            </div>
            <input
              id={`${id}-base`}
              type="range"
              min={TONE_LIMITS.minFrequency}
              max={TONE_LIMITS.maxFrequency}
              value={tone.baseFrequency}
              aria-valuetext={`${tone.baseFrequency} hertz`}
              onChange={(event) => store.set({ baseFrequency: Number(event.target.value) })}
            />
          </div>

          <div className="tone-settings-row">
            <div className="demo-field">
              <label htmlFor={`${id}-profile`}>Harmonic profile</label>
              <select
                id={`${id}-profile`}
                value={tone.profile}
                onChange={(event) => store.set({ profile: event.target.value as HarmonicProfile })}
              >
                {Object.entries(PROFILE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="demo-field">
              <label htmlFor={`${id}-partials`}>Harmonics</label>
              <select
                id={`${id}-partials`}
                value={tone.partials}
                onChange={(event) => store.set({ partials: Number(event.target.value) })}
              >
                {Array.from({ length: TONE_LIMITS.maxPartials }, (_, i) => i + 1).map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="tone-settings-actions">
            <span className="demo-status">Applies to every demo.</span>
            <button type="button" disabled={isDefault} onClick={() => store.reset()}>
              Reset
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
