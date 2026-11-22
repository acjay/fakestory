/**
 * The shared audio engine every demo plays through.
 *
 * Responsibilities:
 *   - Start audio only from a user action. Browsers block sound until the
 *     reader interacts, so the AudioContext is created on the first `play`.
 *   - One demo at a time. Starting a sound stops sounds owned by other demos,
 *     on this page and in other embeds of the site (e.g. several demos
 *     embedded in one Notion page), via a BroadcastChannel.
 *   - Even loudness: every sound, single note or chord, in any voice, is
 *     scaled to the same perceived loudness (see `loudnessScale`).
 *   - Clean starts and stops: every sound fades in and out, so no clicks.
 *   - Stop everything when the page is hidden or closed.
 *   - Clean up: nodes are disconnected once a sound has ended.
 *
 * The browser APIs are injectable, so the lifecycle is tested with fakes.
 */

import {
  DEFAULT_VOICE,
  envelopeFor,
  harmonicAmplitudes,
  loudnessScale,
  partialsOf,
  type Envelope,
  type Voice,
} from './voices';

/** How long the fade out takes when a sound is stopped early, in seconds. */
const STOP_FADE = 0.03;

/** Start slightly in the future, so the first scheduled values aren't missed. */
const SCHEDULE_AHEAD = 0.01;

/** Time constant for gliding to new values in `update`, in seconds. */
const GLIDE = 0.012;

const CHANNEL_NAME = 'fakestory-audio';

/** Thrown when sound can't start: no Web Audio, or the browser blocked it. */
export class AudioUnavailableError extends Error {}

export type PlayOptions = {
  /** Which demo is playing, so other demos' sounds can be stopped. */
  owner: string;

  voice?: Voice;

  /** Seconds. Harmonic voices sustain until stopped if omitted; plucks always fade on their own. */
  duration?: number;
};

/** A playing sound. */
export type Sound = {
  stop(): void;

  /**
   * Change a sustained sound while it plays, e.g. as the reader drags a
   * slider. Frequencies and partial levels glide to their new values, so the
   * change is smooth. Pass the same number of frequencies as were played.
   */
  update(frequencies: number[], voice: Voice): void;

  /** Resolves once the sound has fully ended, whether stopped or finished. */
  finished: Promise<void>;
};

type ActiveSound = Sound & { owner: string };

/** The subset of BroadcastChannel the engine uses. */
type Channel = Pick<BroadcastChannel, 'postMessage' | 'addEventListener'>;

type StartedMessage = { type: 'started'; engine: string };

export type AudioEngineOptions = {
  /** Creates the AudioContext. Defaults to the browser's, if there is one. */
  createContext?: (() => AudioContext) | null;

  /** Where to listen for `visibilitychange`. Defaults to `document`. */
  document?: Pick<Document, 'addEventListener' | 'visibilityState'> | null;

  /** Where to listen for `pagehide`. Defaults to `window`. */
  window?: Pick<Window, 'addEventListener'> | null;

  /** For coordinating with other embeds. Defaults to a BroadcastChannel. */
  channel?: Channel | null;
};

export class AudioEngine {
  private context: AudioContext | null = null;
  private readonly sounds = new Set<ActiveSound>();
  private readonly id = Math.random().toString(36).slice(2);
  private readonly createContext: (() => AudioContext) | null;
  private readonly channel: Channel | null;

  constructor(options: AudioEngineOptions = {}) {
    this.createContext = options.createContext !== undefined ? options.createContext : browserContextFactory();
    this.channel = options.channel !== undefined ? options.channel : browserChannel();

    // Stop when the reader switches tabs or leaves the page.
    const doc = options.document !== undefined ? options.document : globalThis.document;
    doc?.addEventListener('visibilitychange', () => {
      if (doc.visibilityState === 'hidden') {
        this.stopAll();
      }
    });

    const win = options.window !== undefined ? options.window : globalThis.window;
    win?.addEventListener('pagehide', () => {
      this.stopAll();
      void this.context?.suspend();
    });

    // Another embed started a sound: stop ours.
    this.channel?.addEventListener('message', (event) => {
      const message = (event as MessageEvent<StartedMessage>).data;
      if (message?.type === 'started' && message.engine !== this.id) {
        this.stopAll();
      }
    });
  }

  /**
   * Play one or more frequencies together. Call this from a user action
   * (e.g. a click handler), or the browser may refuse to start audio.
   */
  async play(frequencies: number[], { owner, voice = DEFAULT_VOICE, duration }: PlayOptions): Promise<Sound> {
    const context = await this.readyContext();

    // One demo at a time.
    for (const sound of this.sounds) {
      if (sound.owner !== owner) {
        sound.stop();
      }
    }
    this.channel?.postMessage({ type: 'started', engine: this.id } satisfies StartedMessage);

    const start = context.currentTime + SCHEDULE_AHEAD;

    // One gain for everything sounding together, so a chord as a whole is
    // as loud as a single note, and every voice sounds equally loud.
    const scale = loudnessScale(frequencies.flatMap((frequency) => partialsOf(voice, frequency)));
    const notes = frequencies.map((frequency) => this.startNote(context, frequency, voice, scale, start, duration));
    const oscillators = notes.flatMap((n) => n.partials.map((partial) => partial.oscillator));

    let resolveFinished!: () => void;
    const finished = new Promise<void>((resolve) => (resolveFinished = resolve));

    // Once every oscillator has ended, disconnect everything.
    let remaining = oscillators.length;
    for (const oscillator of oscillators) {
      oscillator.onended = () => {
        remaining--;
        if (remaining > 0) {
          return;
        }

        for (const n of notes) {
          n.envelope.disconnect();
          for (const partial of n.partials) {
            partial.oscillator.disconnect();
            partial.gain.disconnect();
          }
        }
        this.sounds.delete(sound);
        resolveFinished();
      };
    }

    const sound: ActiveSound = {
      owner,
      finished,

      stop: () => {
        const now = context.currentTime;
        for (const n of notes) {
          fadeOut(n.envelope.gain, now);
        }
        for (const oscillator of oscillators) {
          try {
            oscillator.stop(now + STOP_FADE + 0.01);
          } catch {
            // Already stopped.
          }
        }
      },

      update: (newFrequencies, newVoice) => {
        const now = context.currentTime;
        const newScale = loudnessScale(newFrequencies.flatMap((frequency) => partialsOf(newVoice, frequency)));

        notes.forEach((n, i) => {
          const frequency = newFrequencies[i];
          if (frequency === undefined) {
            return;
          }

          const amplitudes = harmonicAmplitudes(newVoice, frequency);
          n.partials.forEach((partial, p) => {
            partial.oscillator.frequency.setTargetAtTime(frequency * (p + 1), now, GLIDE);
            partial.gain.gain.setTargetAtTime((amplitudes[p] ?? 0) * newScale, now, GLIDE);
          });
        });
      },
    };

    this.sounds.add(sound);
    if (oscillators.length === 0) {
      this.sounds.delete(sound);
      resolveFinished();
    }

    return sound;
  }

  /** Stop every sound this engine is playing. */
  stopAll(): void {
    for (const sound of this.sounds) {
      sound.stop();
    }
  }

  /** Stop the sounds one demo is playing. */
  stopOwner(owner: string): void {
    for (const sound of this.sounds) {
      if (sound.owner === owner) {
        sound.stop();
      }
    }
  }

  /** Create or resume the AudioContext, or explain why sound can't start. */
  private async readyContext(): Promise<AudioContext> {
    if (!this.createContext) {
      throw new AudioUnavailableError('Audio is unavailable in this browser.');
    }

    this.context ??= this.createContext();
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    if (this.context.state !== 'running') {
      throw new AudioUnavailableError('Audio could not start. Please allow sound in your browser.');
    }

    return this.context;
  }

  /**
   * One note: a sine oscillator per harmonic, each through its own gain (its
   * amplitude, loudness-scaled), all into one envelope gain that shapes the
   * note's volume over time. Separate partials let `update` change each one
   * smoothly, and let demos switch individual partials on and off.
   */
  private startNote(
    context: AudioContext,
    frequency: number,
    voice: Voice,
    scale: number,
    start: number,
    duration: number | undefined,
  ) {
    const envelope = context.createGain();
    envelope.connect(context.destination);

    const partials = harmonicAmplitudes(voice, frequency).map((amplitude, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * (i + 1);

      // Negative amplitudes (the triangle recipe) flip the partial's phase.
      gain.gain.value = amplitude * scale;

      oscillator.connect(gain);
      gain.connect(envelope);
      return { oscillator, gain };
    });

    // Shape the volume over time, from silence up to full and back.
    const end = scheduleEnvelope(envelope.gain, envelopeFor(voice), start, duration);

    for (const { oscillator } of partials) {
      oscillator.start(start);
      if (end !== undefined) {
        oscillator.stop(end + 0.01);
      }
    }

    return { envelope, partials };
  }
}

/**
 * Schedule a note's envelope on its gain (1 = full level). Returns when the
 * note ends, or undefined if it sustains until stopped.
 */
function scheduleEnvelope(
  param: AudioParam,
  envelope: Envelope,
  start: number,
  duration: number | undefined,
): number | undefined {
  param.setValueAtTime(0, start);
  param.linearRampToValueAtTime(1, start + envelope.attack);

  if (envelope.kind === 'pluck') {
    // Strike, quick partial decay, then a long fade to silence.
    param.exponentialRampToValueAtTime(0.6, start + 0.03);
    param.exponentialRampToValueAtTime(0.3, start + 0.1);
    param.setTargetAtTime(0, start + 0.1, (envelope.duration - 0.1) / 5);
    return start + envelope.duration;
  }

  if (duration !== undefined) {
    // Hold, then fade out by the end of the duration.
    const releaseStart = Math.max(start + envelope.attack, start + duration - envelope.release);
    param.setValueAtTime(1, releaseStart);
    param.linearRampToValueAtTime(0, start + duration);
    return start + duration;
  }

  return undefined;
}

/** Fade a gain to silence from wherever it is now, without a click. */
function fadeOut(param: AudioParam, now: number): void {
  if (param.cancelAndHoldAtTime) {
    param.cancelAndHoldAtTime(now);
  } else {
    // Older browsers: hold the current value, then ramp from it.
    const current = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(current, now);
  }
  param.linearRampToValueAtTime(0, now + STOP_FADE);
}

function browserContextFactory(): (() => AudioContext) | null {
  const Context =
    globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  return Context ? () => new Context() : null;
}

function browserChannel(): Channel | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
}

let sharedEngine: AudioEngine | null = null;

/** The one engine for this page, created on first use. */
export function audioEngine(): AudioEngine {
  sharedEngine ??= new AudioEngine();
  return sharedEngine;
}
