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

// ---------------------------------------------------------------------------
// Loudness matching
//
// Ported from the harmonic tone chart demo. Tones with the same peak can
// sound very different in loudness: a square wave sits near its peak most of
// the time, a sawtooth only briefly. So instead of matching peaks, every
// sound is scaled to the same energy, weighted by how well we hear each
// frequency, then capped so its waveform can't peak high enough to distort.
// ---------------------------------------------------------------------------

/** The weighted energy (RMS) every sound is scaled to. */
const TARGET_LOUDNESS = 0.05;

/** The highest the combined waveform may reach, to leave headroom below 1. */
const MAX_PEAK = 0.9;

/** One sine component of a sound: a frequency and its amplitude. */
export type Partial = { frequency: number; amplitude: number };

/**
 * A rough curve of hearing sensitivity: 1 in the midrange, falling off below
 * about 180 Hz and above about 6 kHz, where we hear sounds as quieter.
 */
export function hearingWeight(frequency: number): number {
  return frequency / Math.hypot(frequency, 180) / Math.sqrt(1 + (frequency / 6000) ** 4);
}

/**
 * The gain to apply to a sound's partials, given at their raw amplitudes,
 * so it plays at the target loudness without distorting. Pass every partial
 * of every note sounding together, so a chord as a whole matches a single
 * note.
 */
export function loudnessScale(partials: Partial[]): number {
  // A sine of amplitude a has mean power a²/2; weight each by audibility.
  const energy = partials.reduce(
    (sum, { frequency, amplitude }) => sum + (amplitude * hearingWeight(frequency)) ** 2 / 2,
    0,
  );

  // The worst case peak: every partial at its maximum at once.
  const worstPeak = partials.reduce((sum, { amplitude }) => sum + Math.abs(amplitude), 0);

  if (energy === 0) {
    return 0;
  }
  return Math.min(TARGET_LOUDNESS / Math.sqrt(energy), MAX_PEAK / worstPeak);
}

/** A voice's partials for one note, at raw amplitudes (before loudness scaling). */
export function partialsOf(voice: Voice, frequency: number): Partial[] {
  return harmonicAmplitudes(voice, frequency).map((amplitude, i) => ({
    frequency: (i + 1) * frequency,
    amplitude,
  }));
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
