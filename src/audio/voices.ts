/**
 * Voices: what a note sounds like, as pure data and math.
 *
 * A voice is a recipe of harmonics (partials at whole-number multiples of
 * the fundamental) plus an envelope. The engine (engine.ts) turns this into
 * Web Audio nodes; keeping the math here makes it testable and lets graphs
 * draw exactly what the audio plays.
 */

/** The three classic harmonic recipes, named after the waveforms they build. */
export type HarmonicProfile = 'sawtooth' | 'square' | 'triangle';

export type Voice =
  /** A sustained tone built from `partials` harmonics in a classic recipe. */
  | { kind: 'harmonic'; profile: HarmonicProfile; partials: number }
  /** A plucked, guitar-like tone that fades on its own (the Part 2 CodePen sound). */
  | { kind: 'pluck' };

/** The default voice for every demo: all harmonics at 1/n, 16 of them. */
export const DEFAULT_VOICE: Voice = { kind: 'harmonic', profile: 'sawtooth', partials: 16 };

/** How long a pluck rings, in seconds. */
export const PLUCK_DURATION = 2.5;

const PLUCK_PARTIALS = 10;

/**
 * Highest partial frequency kept, in hertz. Partials above this are inaudible
 * to most people and, near half the sample rate, cause aliasing artifacts.
 */
export const MAX_PARTIAL_FREQUENCY = 16000;

/**
 * The amplitude of each harmonic, fundamental first: index 0 is harmonic 1.
 * Amplitudes can be negative (the triangle recipe alternates signs); that
 * changes the waveform's shape, not how it sounds.
 *
 * Harmonics above MAX_PARTIAL_FREQUENCY are set to zero.
 */
export function harmonicAmplitudes(voice: Voice, frequency: number): number[] {
  const amplitudes = voice.kind === 'pluck' ? pluckAmplitudes() : profileAmplitudes(voice.profile, voice.partials);

  return amplitudes.map((amplitude, i) => ((i + 1) * frequency > MAX_PARTIAL_FREQUENCY ? 0 : amplitude));
}

function profileAmplitudes(profile: HarmonicProfile, partials: number): number[] {
  return Array.from({ length: partials }, (_, i) => {
    const n = i + 1;
    const isOdd = n % 2 === 1;

    switch (profile) {
      // Every harmonic, falling off as 1/n.
      case 'sawtooth':
        return 1 / n;

      // Odd harmonics only, falling off as 1/n.
      case 'square':
        return isOdd ? 1 / n : 0;

      // Odd harmonics only, falling off faster (1/n²), alternating in sign.
      case 'triangle':
        return isOdd ? (n % 4 === 1 ? 1 : -1) / n ** 2 : 0;
    }
  });
}

/** The pluck's spectrum, from the original CodePen demos: 10 harmonics at 1/n^0.8. */
function pluckAmplitudes(): number[] {
  return Array.from({ length: PLUCK_PARTIALS }, (_, i) => (i + 1) ** -0.8);
}

/**
 * A gain factor that keeps low and high notes at a similar perceived
 * loudness: higher notes sound louder, so they're turned down a little.
 * From the original pluck demos, centered on 440 Hz and capped for very low
 * notes.
 */
export function loudnessCompensation(frequency: number): number {
  return Math.min(1.5, (440 / frequency) ** 0.3);
}

/**
 * The volume envelope, in seconds and relative gain (1 = the note's level).
 *
 * - Harmonic voices sustain: a quick fade in, then hold until stopped (or
 *   until `duration` ends), then a quick fade out. The fades prevent clicks.
 * - The pluck strikes, decays and fades away by itself over PLUCK_DURATION.
 */
export type Envelope =
  { kind: 'sustain'; attack: number; release: number } | { kind: 'pluck'; attack: number; duration: number };

export function envelopeFor(voice: Voice): Envelope {
  return voice.kind === 'pluck'
    ? { kind: 'pluck', attack: 0.005, duration: PLUCK_DURATION }
    : { kind: 'sustain', attack: 0.01, release: 0.03 };
}
