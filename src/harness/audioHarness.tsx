/**
 * A development-only page for trying the audio engine by hand: open
 * /harness/audio.html while `npm run dev` is running.
 *
 * Two panels stand in for two demos, so you can check that starting one
 * stops the other, that Stop is clean, and that sound stops when you switch
 * tabs. Not part of the site: `npm run build` only builds index.html.
 */

import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { audioEngine, AudioUnavailableError, type Sound } from '../audio/engine';
import { DEFAULT_VOICE, type HarmonicProfile, type Voice } from '../audio/voices';
import { note, noteFrequency, noteLabel } from '../music/notes';
import { DEFAULT_BASE_FREQUENCY } from '../music/pitch';
import { pythagoreanPitchClasses } from '../music/pitchClasses';

type VoiceChoice = HarmonicProfile | 'pluck';

function voiceFor(choice: VoiceChoice, partials: number): Voice {
  return choice === 'pluck' ? { kind: 'pluck' } : { kind: 'harmonic', profile: choice, partials };
}

function Harness() {
  const [baseFrequency, setBaseFrequency] = useState(DEFAULT_BASE_FREQUENCY);
  const [voiceChoice, setVoiceChoice] = useState<VoiceChoice>(
    DEFAULT_VOICE.kind === 'harmonic' ? DEFAULT_VOICE.profile : 'pluck',
  );
  const [partials, setPartials] = useState(16);

  const voice = voiceFor(voiceChoice, partials);

  return (
    <main style={{ font: '16px/1.5 system-ui, sans-serif', maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 24 }}>Audio harness</h1>
      <p>
        Development only. Each panel plays as a separate “demo”: starting one stops the other. Switching tabs stops
        everything.
      </p>

      <fieldset>
        <legend>Tone</legend>
        <label>
          Base frequency (α1){' '}
          <input
            type="number"
            min={50}
            max={1000}
            value={baseFrequency}
            onChange={(event) => setBaseFrequency(Number(event.target.value) || DEFAULT_BASE_FREQUENCY)}
          />{' '}
          Hz
        </label>{' '}
        <label>
          Voice{' '}
          <select value={voiceChoice} onChange={(event) => setVoiceChoice(event.target.value as VoiceChoice)}>
            <option value="sawtooth">Sawtooth (all harmonics, 1/n)</option>
            <option value="square">Square (odd harmonics, 1/n)</option>
            <option value="triangle">Triangle (odd harmonics, 1/n²)</option>
            <option value="pluck">Pluck</option>
          </select>
        </label>{' '}
        {voiceChoice !== 'pluck' && (
          <label>
            Harmonics{' '}
            <input
              type="number"
              min={1}
              max={32}
              value={partials}
              onChange={(event) => setPartials(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
        )}
      </fieldset>

      <DemoPanel owner="Demo A" baseFrequency={baseFrequency} voice={voice} />
      <DemoPanel owner="Demo B" baseFrequency={baseFrequency} voice={voice} />

      <p>
        <button type="button" onClick={() => audioEngine().stopAll()}>
          Stop everything
        </button>
      </p>
    </main>
  );
}

function DemoPanel({ owner, baseFrequency, voice }: { owner: string; baseFrequency: number; voice: Voice }) {
  const [status, setStatus] = useState('Silent');
  const current = useRef<Sound | null>(null);

  const [α, β, γ] = pythagoreanPitchClasses(3);
  const α1 = note(α);
  const β1 = note(β);
  const γ1 = note(γ);
  const hz = (n: typeof α1) => Math.round(noteFrequency(n, baseFrequency) * 100) / 100;

  async function play(label: string, frequencies: number[], duration?: number) {
    try {
      current.current?.stop();
      const sound = await audioEngine().play(frequencies, { owner, voice, duration });
      current.current = sound;
      setStatus(`Playing ${label}`);

      await sound.finished;
      if (current.current === sound) {
        current.current = null;
        setStatus('Silent');
      }
    } catch (error) {
      setStatus(error instanceof AudioUnavailableError ? error.message : 'Something went wrong starting audio.');
    }
  }

  return (
    <fieldset style={{ marginTop: 16 }}>
      <legend>{owner}</legend>
      <button type="button" onClick={() => play(noteLabel(α1), [hz(α1)])}>
        {noteLabel(α1)} ({hz(α1)} Hz), until stopped
      </button>{' '}
      <button type="button" onClick={() => play(`${noteLabel(α1)} for 1 s`, [hz(α1)], 1)}>
        {noteLabel(α1)} for 1 second
      </button>{' '}
      <button type="button" onClick={() => play(`${noteLabel(α1)} & ${noteLabel(β1)}`, [hz(α1), hz(β1)])}>
        {noteLabel(α1)} & {noteLabel(β1)}
      </button>{' '}
      <button type="button" onClick={() => play(`${noteLabel(α1)} & ${noteLabel(γ1)}`, [hz(α1), hz(γ1)])}>
        {noteLabel(α1)} & {noteLabel(γ1)}
      </button>{' '}
      <button type="button" onClick={() => audioEngine().stopOwner(owner)}>
        Stop
      </button>
      <p role="status" style={{ margin: '8px 0 0', color: '#555' }}>
        {status}
      </p>
    </fieldset>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
