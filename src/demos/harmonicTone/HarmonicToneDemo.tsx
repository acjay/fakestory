/**
 * The harmonic tone demo: build a tone from harmonics and see and hear how
 * each one contributes. Rebuilt from the original uploaded HTML demo on the
 * shared audio engine.
 *
 * Only controls, values and minimal labels live here; explanations stay in
 * the story (see the embed contract).
 */

import { useEffect, useId, useRef, useState } from 'react';

import { audioEngine, AudioUnavailableError, type Sound } from '../../audio/engine';
import type { Articulation, HarmonicProfile, Voice } from '../../audio/voices';
import { NumberField } from '../NumberField';
import { DemoError } from '../DemoError';
import { DemoHeader } from '../DemoHeader';
import { useToneSettings } from '../useToneSettings';
import { WaveformPlot } from '../views/WaveformPlot';
import {
  activePreset,
  COLLAPSED_ROWS,
  enabledThrough,
  formatAmplitude,
  GRAPH_WINDOW,
  harmonicValue,
  MAX_FUNDAMENTAL,
  MAX_HARMONICS,
  MIN_FUNDAMENTAL,
  mixSummary,
  mixValue,
  mixVoice,
  PRESETS,
  PROFILE_LABELS,
  profileLevels,
  fixedByUrl,
  settingsFromParams,
  soloVoice,
  type HarmonicToneSettings,
} from './model';

import '../demo.css';

type Playback = { mode: 'idle' } | { mode: 'tone' } | { mode: 'continuous' } | { mode: 'solo'; harmonic: number };

export function HarmonicToneDemo({ params, title }: { params: URLSearchParams; title: string }) {
  const tone = useToneSettings();
  const [settings, setSettings] = useState<HarmonicToneSettings>(() => settingsFromParams(params, tone));
  const [showAllRows, setShowAllRows] = useState(() => settings.enabled.slice(COLLAPSED_ROWS).some(Boolean));
  const [playback, setPlayback] = useState<Playback>({ mode: 'idle' });
  const [error, setError] = useState<string | null>(null);

  // Each instance is its own "demo" to the engine, so starting another demo stops this one.
  const owner = useId();
  const sound = useRef<Sound | null>(null);

  const { fundamental, profile, enabled } = settings;
  const levels = profileLevels(profile);
  const preset = activePreset(enabled);
  const rowCount = showAllRows ? MAX_HARMONICS : COLLAPSED_ROWS;

  // Follow the reader's shared tone settings, except where the embed URL
  // fixes a value.
  // (The query string, not the params object: the object can be recreated
  // on every render of the story, which would wipe the reader's changes.)
  const query = params.toString();
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const fixed = fixedByUrl(new URLSearchParams(query));
    setSettings((current) => ({
      ...current,
      fundamental: fixed.fundamental ?? tone.baseFrequency,
      profile: fixed.profile ?? tone.profile,
    }));
  }, [tone.baseFrequency, tone.profile, query]);

  // While sustaining, follow every change to the controls.
  useEffect(() => {
    if (playback.mode === 'continuous' || playback.mode === 'solo') {
      sound.current?.update([fundamental], currentVoice(settings, playback));
    }
  }, [settings, playback, fundamental]);

  // Stop when the demo goes away.
  useEffect(() => () => sound.current?.stop(), []);

  // --- Playback -------------------------------------------------------------

  /** Start a sound, and return to idle when it ends (however it ends). */
  async function start(voice: Voice, next: Playback, articulation: Articulation = 'sustain') {
    sound.current?.stop();
    setError(null);

    try {
      const started = await audioEngine().play([fundamental], { owner, voice, articulation });
      sound.current = started;
      setPlayback(next);

      await started.finished;
      if (sound.current === started) {
        sound.current = null;
        setPlayback({ mode: 'idle' });
      }
    } catch (caught) {
      sound.current = null;
      setPlayback({ mode: 'idle' });
      setError(caught instanceof AudioUnavailableError ? caught.message : 'Audio could not start.');
    }
  }

  /** Switch what's sustaining, smoothly if something already is. */
  function sustain(next: Playback) {
    const isSustaining = playback.mode === 'continuous' || playback.mode === 'solo';
    if (isSustaining && sound.current) {
      setPlayback(next);
      return;
    }
    void start(currentVoice(settings, next), next);
  }

  function stop() {
    sound.current?.stop();
  }

  // A one-second struck tone: each harmonic dies away at its own rate.
  const playTone = () => void start(mixVoice(settings), { mode: 'tone' }, 'struck');

  const toggleContinuous = () => (playback.mode === 'continuous' ? stop() : sustain({ mode: 'continuous' }));

  const toggleSolo = (harmonic: number) =>
    playback.mode === 'solo' && playback.harmonic === harmonic ? stop() : sustain({ mode: 'solo', harmonic });

  // --- Settings -------------------------------------------------------------

  const update = (change: Partial<HarmonicToneSettings>) => setSettings((current) => ({ ...current, ...change }));

  const setFundamental = (value: number) => {
    if (Number.isFinite(value)) {
      update({ fundamental: Math.min(MAX_FUNDAMENTAL, Math.max(MIN_FUNDAMENTAL, Math.round(value))) });
    }
  };

  const choosePreset = (through: number) => {
    update({ enabled: enabledThrough(through) });
    if (through > COLLAPSED_ROWS) {
      setShowAllRows(true);
    }
  };

  const toggleHarmonic = (index: number) => update({ enabled: enabled.map((on, i) => (i === index ? !on : on)) });

  // --- View -----------------------------------------------------------------

  const enabledCount = enabled.filter(Boolean).length;
  const highestEnabled = enabled.lastIndexOf(true) + 1;

  return (
    <div className="demo harmonic-tone">
      <DemoHeader title={title} />

      <div className="demo-controls">
        <div className="demo-field demo-field-wide">
          <div className="demo-field-label">
            <label htmlFor={`${owner}-fundamental`}>Fundamental</label>
            <span className="demo-number">
              <NumberField
                min={MIN_FUNDAMENTAL}
                max={MAX_FUNDAMENTAL}
                value={fundamental}
                aria-label="Fundamental frequency in hertz"
                onChange={setFundamental}
              />
              Hz
            </span>
          </div>
          <input
            id={`${owner}-fundamental`}
            type="range"
            min={MIN_FUNDAMENTAL}
            max={MAX_FUNDAMENTAL}
            step={1}
            value={fundamental}
            aria-valuetext={`${fundamental} hertz`}
            onChange={(event) => setFundamental(Number(event.target.value))}
          />
        </div>

        <div className="demo-field">
          <label htmlFor={`${owner}-profile`}>Harmonic profile</label>
          <select
            id={`${owner}-profile`}
            value={profile}
            onChange={(event) => update({ profile: event.target.value as HarmonicProfile })}
          >
            {Object.entries(PROFILE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="demo-toolbar">
        <div className="demo-segmented" role="group" aria-label="Include harmonics up to">
          <span className="demo-segmented-label">Through harmonic</span>
          {PRESETS.map((through) => (
            <button key={through} type="button" aria-pressed={preset === through} onClick={() => choosePreset(through)}>
              {through}
            </button>
          ))}
        </div>

        <div className="demo-playback">
          <button
            type="button"
            className={`demo-primary${playback.mode === 'tone' ? ' is-sounding' : ''}`}
            onClick={playTone}
          >
            ▶ Play tone
          </button>
          <button
            type="button"
            className={playback.mode === 'continuous' ? 'is-sounding' : undefined}
            aria-pressed={playback.mode === 'continuous'}
            onClick={toggleContinuous}
          >
            {playback.mode === 'continuous' ? '■ Stop' : '▷ Play continuously'}
          </button>
        </div>
      </div>

      <DemoError error={error} />

      <section className="demo-panel" aria-label="Combined waveform">
        <div className="demo-panel-head">
          <strong>Combined waveform</strong>
          <span>{mixSummary(enabled)}</span>
        </div>
        <WaveformPlot
          value={(t) => mixValue(settings, t)}
          window={GRAPH_WINDOW}
          range={2}
          highestFrequency={fundamental * Math.max(1, highestEnabled)}
          height={120}
          label={`Combined waveform of ${enabledCount} enabled partials at ${fundamental} hertz over 20 milliseconds, on a scale from −2 to 2.`}
        />
      </section>

      <div className="demo-panel-head demo-rows-head">
        <strong>Partials</strong>
        <span>Waveforms · 0–20 ms</span>
      </div>

      <ol className="harmonic-rows">
        {levels.slice(0, rowCount).map((level, index) => {
          const harmonic = index + 1;
          const isOn = enabled[index];
          const isSolo = playback.mode === 'solo' && playback.harmonic === harmonic;
          const frequency = fundamental * harmonic;

          return (
            <li key={harmonic} className={`harmonic-row${isOn ? '' : ' harmonic-row-off'}`}>
              <label className="harmonic-toggle">
                <input type="checkbox" checked={isOn} onChange={() => toggleHarmonic(index)} />
                <span>
                  <span className="harmonic-title">
                    {harmonic} · {harmonic === 1 ? 'Fundamental' : 'Harmonic'}
                  </span>
                  <span className="harmonic-detail">
                    {frequency} Hz · amp {formatAmplitude(level)}
                  </span>
                </span>
              </label>

              <WaveformPlot
                value={(t) => harmonicValue(level, harmonic, fundamental, t)}
                window={GRAPH_WINDOW}
                range={1}
                highestFrequency={frequency}
                muted={!isOn}
                label={`Partial ${harmonic} at ${frequency} hertz, amplitude ${formatAmplitude(level)}${isOn ? '' : ', not included'}.`}
              />

              <button
                type="button"
                className={`harmonic-solo${isSolo ? ' is-sounding' : ''}`}
                aria-pressed={isSolo}
                aria-label={`Hear partial ${harmonic} alone`}
                onClick={() => toggleSolo(harmonic)}
              >
                {isSolo ? '■' : 'Solo'}
              </button>
            </li>
          );
        })}
      </ol>

      {!showAllRows && (
        <button type="button" className="demo-link" onClick={() => setShowAllRows(true)}>
          Show all {MAX_HARMONICS} harmonics
        </button>
      )}
    </div>
  );
}

function currentVoice(settings: HarmonicToneSettings, playback: Playback): Voice {
  return playback.mode === 'solo' ? soloVoice(settings, playback.harmonic) : mixVoice(settings);
}
