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
  | { kind: 'pluck' }
  /** Any mix of harmonics, by amplitude (index 0 is the fundamental). Sustained, like `harmonic`. */
  | { kind: 'partials'; amplitudes: number[] };

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
  const amplitudes =
    voice.kind === 'pluck'
      ? pluckAmplitudes()
      : voice.kind === 'partials'
        ? voice.amplitudes
        : profileAmplitudes(voice.profile, voice.partials);

  return amplitudes.map((amplitude, i) => ((i + 1) * frequency > MAX_PARTIAL_FREQUENCY ? 0 : amplitude));
}

/** The amplitudes of a classic recipe, fundamental first. */
export function profileAmplitudes(profile: HarmonicProfile, partials: number): number[] {
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

/** One sine component of a sound: which harmonic, its frequency and its amplitude. */
export type Partial = { harmonic: number; frequency: number; amplitude: number };

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
 *
 * For a struck sound, each partial's energy is averaged over its envelope
 * (higher harmonics fade sooner, so they contribute less), and the peak
 * allows for the strike's boost. Without this, a struck tone would play
 * quieter than a sustained one.
 */
export function loudnessScale(partials: Partial[], articulation: Articulation = 'sustain', duration = 1): number {
  const struck = articulation === 'struck';

  // A sine of amplitude a has mean power a²/2; weight each by audibility.
  const energy = partials.reduce((sum, { harmonic, frequency, amplitude }) => {
    const envelopeEnergy = struck ? struckEnvelopeEnergy(harmonic, duration) : 1;
    return sum + ((amplitude * hearingWeight(frequency)) ** 2 / 2) * envelopeEnergy;
  }, 0);

  // The worst case peak: every partial at its maximum at once.
  const worstPeak = partials.reduce((sum, { amplitude }) => sum + Math.abs(amplitude), 0) * (struck ? STRUCK.boost : 1);

  if (energy === 0) {
    return 0;
  }
  return Math.min(TARGET_LOUDNESS / Math.sqrt(energy), MAX_PEAK / worstPeak);
}

/** A voice's partials for one note, at raw amplitudes (before loudness scaling). */
export function partialsOf(voice: Voice, frequency: number): Partial[] {
  return harmonicAmplitudes(voice, frequency).map((amplitude, i) => ({
    harmonic: i + 1,
    frequency: (i + 1) * frequency,
    amplitude,
  }));
}

// ---------------------------------------------------------------------------
// Envelopes: how a note's volume changes over time
// ---------------------------------------------------------------------------

/**
 * How a harmonic voice is played:
 * - `sustain`: steady, until stopped or for a duration. For playing
 *   continuously while the reader adjusts controls.
 * - `struck`: like a struck string or bell. A sharp attack, then each
 *   harmonic dies away at its own rate, higher ones faster. For one-off
 *   tones. (Ported from the original harmonic tone chart.)
 *
 * The pluck voice always uses its own envelope.
 */
export type Articulation = 'sustain' | 'struck';

/** The struck envelope's shape, from the original harmonic tone chart. Times in seconds. */
export const STRUCK = {
  /** Rise to the strike's peak. */
  attack: 0.003,

  /** The strike's peak, relative to the level the tone then settles at. */
  boost: 1.5,

  /** By this time, the strike has settled into the harmonic's decay. */
  settle: 0.04,

  /** Final fade to silence at the end of the duration. */
  release: 0.08,
};

/** Default length of a struck tone, in seconds. */
export const STRUCK_DURATION = 1;

/**
 * How quickly a harmonic dies away in a struck tone: its time constant, in
 * seconds. The fundamental lasts longest; higher harmonics fade sooner, so
 * the tone darkens as it rings.
 */
export function struckDecayTime(harmonic: number): number {
  return 1.1 / harmonic ** 0.72;
}

/**
 * A harmonic's level at time `t` (seconds) in a struck tone lasting
 * `duration`, relative to its amplitude: up to STRUCK.boost during the strike,
 * then decaying, then fading out.
 */
export function struckEnvelopeAt(harmonic: number, t: number, duration = STRUCK_DURATION): number {
  const { attack, boost, settle, release } = STRUCK;
  const tau = struckDecayTime(harmonic);

  if (t <= 0 || t >= duration) {
    return 0;
  }

  // The strike: a fast rise, then an exponential fall onto the decay curve.
  if (t <= attack) {
    return (boost * t) / attack;
  }
  if (t <= settle) {
    const settled = Math.exp(-(settle - attack) / tau);
    return boost * (settled / boost) ** ((t - attack) / (settle - attack));
  }

  // The decay, then a linear fade to silence.
  if (t <= duration - release) {
    return Math.exp(-(t - attack) / tau);
  }
  return (Math.exp(-(duration - release - attack) / tau) * (duration - t)) / release;
}

/** The average of the struck envelope squared over its duration: how much energy it keeps. */
function struckEnvelopeEnergy(harmonic: number, duration: number): number {
  const samples = 2000;
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    sum += struckEnvelopeAt(harmonic, (duration * (i + 0.5)) / samples, duration) ** 2;
  }
  return sum / samples;
}

/**
 * The volume envelope, in seconds and relative gain (1 = the note's level).
 *
 * - `sustain`: a quick fade in, then hold until stopped (or until `duration`
 *   ends), then a quick fade out. The fades prevent clicks.
 * - `pluck`: strikes, decays and fades away by itself over PLUCK_DURATION.
 * - `struck`: see `struckEnvelopeAt`; each harmonic has its own decay.
 */
export type Envelope =
  | { kind: 'sustain'; attack: number; release: number }
  | { kind: 'pluck'; attack: number; duration: number }
  | ({ kind: 'struck'; duration: number } & typeof STRUCK);

export function envelopeFor(voice: Voice, articulation: Articulation = 'sustain', duration?: number): Envelope {
  if (voice.kind === 'pluck') {
    return { kind: 'pluck', attack: 0.005, duration: PLUCK_DURATION };
  }
  if (articulation === 'struck') {
    return { kind: 'struck', duration: duration ?? STRUCK_DURATION, ...STRUCK };
  }
  return { kind: 'sustain', attack: 0.01, release: 0.03 };
}
