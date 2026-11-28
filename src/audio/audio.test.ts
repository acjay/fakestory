import { beforeEach, describe, expect, it } from 'vitest';

import { AudioEngine, AudioUnavailableError } from './engine';
import {
  DEFAULT_VOICE,
  harmonicAmplitudes,
  hearingWeight,
  loudnessScale,
  MAX_PARTIAL_FREQUENCY,
  partialsOf,
  STRUCK,
  struckDecayTime,
  struckEnvelopeAt,
  type Voice,
} from './voices';

// ---------------------------------------------------------------------------
// Voices
// ---------------------------------------------------------------------------

describe('voices', () => {
  const rounded = (values: number[]) => values.map((value) => Math.round(value * 1000) / 1000);

  it('default to a 16-harmonic square', () => {
    expect(DEFAULT_VOICE).toEqual({ kind: 'harmonic', profile: 'square', partials: 16 });
    expect(harmonicAmplitudes(DEFAULT_VOICE, 200)).toHaveLength(16);
  });

  it('build the three classic recipes', () => {
    const amplitudes = (profile: 'sawtooth' | 'square' | 'triangle') =>
      rounded(harmonicAmplitudes({ kind: 'harmonic', profile, partials: 5 }, 100));

    expect(amplitudes('sawtooth')).toEqual([1, 0.5, 0.333, 0.25, 0.2]);
    expect(amplitudes('square')).toEqual([1, 0, 0.333, 0, 0.2]);
    expect(amplitudes('triangle')).toEqual([1, 0, -0.111, 0, 0.04]);
  });

  it('match the original pluck spectrum', () => {
    expect(rounded(harmonicAmplitudes({ kind: 'pluck' }, 200)).slice(0, 3)).toEqual([1, 0.574, 0.415]);
  });

  it('drop harmonics above the audible limit', () => {
    const amplitudes = harmonicAmplitudes({ kind: 'harmonic', profile: 'sawtooth', partials: 16 }, 2000);

    // Harmonic 8 is at 16 kHz, the limit; harmonic 9 is above it.
    expect(amplitudes[7]).toBeGreaterThan(0);
    expect(amplitudes.slice(8).every((amplitude) => amplitude === 0)).toBe(true);
    expect(MAX_PARTIAL_FREQUENCY).toBe(16000);
  });
});

// ---------------------------------------------------------------------------
// Loudness matching
// ---------------------------------------------------------------------------

describe('loudness matching', () => {
  /** The hearing-weighted RMS of a sound after scaling: what's matched. */
  const weightedLoudness = (voice: Voice, frequencies: number[]) => {
    const partials = frequencies.flatMap((frequency) => partialsOf(voice, frequency));
    const scale = loudnessScale(partials);
    const energy = partials.reduce((sum, p) => sum + (p.amplitude * scale * hearingWeight(p.frequency)) ** 2 / 2, 0);
    return Math.sqrt(energy);
  };
  const worstPeak = (voice: Voice, frequencies: number[]) => {
    const partials = frequencies.flatMap((frequency) => partialsOf(voice, frequency));
    return loudnessScale(partials) * partials.reduce((sum, p) => sum + Math.abs(p.amplitude), 0);
  };

  const sawtooth: Voice = { kind: 'harmonic', profile: 'sawtooth', partials: 16 };
  const square: Voice = { kind: 'harmonic', profile: 'square', partials: 16 };
  const triangle: Voice = { kind: 'harmonic', profile: 'triangle', partials: 16 };

  it('makes every voice equally loud', () => {
    const levels = [sawtooth, square, triangle, { kind: 'pluck' } as Voice].map((voice) =>
      weightedLoudness(voice, [200]),
    );

    for (const level of levels) {
      expect(level).toBeCloseTo(levels[0], 6);
    }
  });

  it('makes a chord as loud as a single note', () => {
    expect(weightedLoudness(sawtooth, [200, 300])).toBeCloseTo(weightedLoudness(sawtooth, [200]), 6);
  });

  it('keeps low and high notes equally loud, allowing for hearing', () => {
    expect(weightedLoudness(sawtooth, [100])).toBeCloseTo(weightedLoudness(sawtooth, [800]), 6);
  });

  it('never lets the waveform peak high enough to distort', () => {
    for (const voice of [sawtooth, square, triangle]) {
      for (const frequencies of [[200], [200, 300], [80, 120, 160, 200]]) {
        expect(worstPeak(voice, frequencies)).toBeLessThanOrEqual(0.9 + 1e-9);
      }
    }
  });

  it('weights hearing: quieter below ~180 Hz and above ~6 kHz', () => {
    expect(hearingWeight(1000)).toBeGreaterThan(0.95);
    expect(hearingWeight(60)).toBeLessThan(0.4);
    expect(hearingWeight(12000)).toBeLessThan(0.3);
  });

  it('is silent for silence', () => {
    expect(loudnessScale([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The struck envelope
// ---------------------------------------------------------------------------

describe('struck envelope', () => {
  it('rises to the boosted strike, then decays to silence by the end', () => {
    expect(struckEnvelopeAt(1, 0)).toBe(0);
    expect(struckEnvelopeAt(1, STRUCK.attack)).toBeCloseTo(STRUCK.boost, 12);
    expect(struckEnvelopeAt(1, 0.5)).toBeLessThan(1);
    expect(struckEnvelopeAt(1, 1)).toBe(0);
  });

  it('joins the decay curve smoothly after the strike', () => {
    const atSettle = struckEnvelopeAt(1, STRUCK.settle);
    const justAfter = struckEnvelopeAt(1, STRUCK.settle + 1e-9);

    expect(atSettle).toBeCloseTo(justAfter, 6);
  });

  it('fades higher harmonics faster, so the tone darkens', () => {
    expect(struckDecayTime(1)).toBeCloseTo(1.1, 12);
    expect(struckDecayTime(8)).toBeLessThan(struckDecayTime(2));
    expect(struckEnvelopeAt(8, 0.5)).toBeLessThan(struckEnvelopeAt(1, 0.5));
  });

  it('is loudness-matched to a sustained tone, accounting for the decay', () => {
    const partials = partialsOf(DEFAULT_VOICE, 200);

    // Decaying harmonics carry less energy, so a struck tone gets more gain.
    expect(loudnessScale(partials, 'struck')).toBeGreaterThan(loudnessScale(partials, 'sustain'));
  });

  it('leaves room for the strike in the peak cap', () => {
    const loud: Voice = { kind: 'harmonic', profile: 'square', partials: 16 };
    const partials = [100, 150, 200, 250].flatMap((frequency) => partialsOf(loud, frequency));
    const worstPeak =
      loudnessScale(partials, 'struck') * STRUCK.boost * partials.reduce((sum, p) => sum + Math.abs(p.amplitude), 0);

    expect(worstPeak).toBeLessThanOrEqual(0.9 + 1e-9);
  });
});

// ---------------------------------------------------------------------------
// A fake Web Audio API that records what the engine schedules
// ---------------------------------------------------------------------------

class FakeParam {
  value = 0;
  events: [string, ...number[]][] = [];

  setValueAtTime(value: number, time: number) {
    this.events.push(['set', value, time]);
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push(['linear', value, time]);
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.events.push(['exponential', value, time]);
  }
  setTargetAtTime(value: number, time: number, constant: number) {
    this.events.push(['target', value, time, constant]);
  }
  cancelAndHoldAtTime(time: number) {
    this.events.push(['cancelAndHold', time]);
  }
}

class FakeNode {
  connectedTo: unknown = null;
  disconnected = false;

  connect(target: unknown) {
    this.connectedTo = target;
  }
  disconnect() {
    this.disconnected = true;
  }
}

class FakeOscillator extends FakeNode {
  type = 'sine';
  frequency = new FakeParam();
  wave: { real: Float32Array; imag: Float32Array; normalized: boolean } | null = null;
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  onended: (() => void) | null = null;

  setPeriodicWave(wave: { real: Float32Array; imag: Float32Array; normalized: boolean }) {
    this.wave = wave;
  }
  start(time: number) {
    this.startedAt = time;
  }
  stop(time: number) {
    this.stoppedAt = time;
  }
  /** Simulate the browser reaching the stop time. */
  end() {
    this.onended?.();
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeContext {
  state: AudioContextState;
  currentTime = 10;
  destination = { name: 'speakers' };
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  resumeCalls = 0;
  suspended = false;

  private readonly resumeTo: AudioContextState;

  constructor(initialState: AudioContextState = 'suspended', resumeTo: AudioContextState = 'running') {
    this.state = initialState;
    this.resumeTo = resumeTo;
  }

  async resume() {
    this.resumeCalls++;
    this.state = this.resumeTo;
  }
  async suspend() {
    this.suspended = true;
  }
  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createPeriodicWave(real: Float32Array, imag: Float32Array, options?: { disableNormalization?: boolean }) {
    return { real, imag, normalized: !options?.disableNormalization };
  }
}

/** A message bus standing in for BroadcastChannel, shared by "embeds". */
class FakeChannel extends EventTarget {
  sent: unknown[] = [];

  private readonly peers: FakeChannel[];

  constructor(peers: FakeChannel[] = []) {
    super();
    this.peers = peers;
    peers.push(this);
  }
  postMessage(data: unknown) {
    this.sent.push(data);
    for (const peer of this.peers) {
      if (peer !== this) {
        peer.dispatchEvent(new MessageEvent('message', { data }));
      }
    }
  }
}

class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';

  hide() {
    this.visibilityState = 'hidden';
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

function setup(context = new FakeContext()) {
  let created = 0;
  const document = new FakeDocument();
  const window = new EventTarget();
  const channel = new FakeChannel();

  const engine = new AudioEngine({
    createContext: () => {
      created++;
      return context as unknown as AudioContext;
    },
    document: document as unknown as Document,
    window: window as unknown as Window,
    channel,
  });

  return { engine, context, document, window, channel, contextsCreated: () => created };
}

/** Let promise callbacks run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// ---------------------------------------------------------------------------
// Engine lifecycle
// ---------------------------------------------------------------------------

describe('audio engine', () => {
  let env: ReturnType<typeof setup>;
  beforeEach(() => {
    env = setup();
  });

  it('creates no AudioContext until something plays', async () => {
    expect(env.contextsCreated()).toBe(0);

    await env.engine.play([200], { owner: 'a' });
    await env.engine.play([300], { owner: 'a' });

    expect(env.contextsCreated()).toBe(1);
  });

  it('resumes a suspended context (browsers start them suspended)', async () => {
    await env.engine.play([200], { owner: 'a' });

    expect(env.context.resumeCalls).toBe(1);
  });

  it('explains when the browser blocks audio', async () => {
    const blocked = setup(new FakeContext('suspended', 'suspended'));

    await expect(blocked.engine.play([200], { owner: 'a' })).rejects.toThrow(AudioUnavailableError);
    await expect(blocked.engine.play([200], { owner: 'a' })).rejects.toThrow(/allow sound/);
  });

  it('explains when there is no Web Audio at all', async () => {
    const engine = new AudioEngine({ createContext: null, document: null, window: null, channel: null });

    await expect(engine.play([200], { owner: 'a' })).rejects.toThrow(/unavailable in this browser/);
  });

  it('plays each harmonic as its own sine, through an envelope, to the speakers', async () => {
    const sawtooth: Voice = { kind: 'harmonic', profile: 'sawtooth', partials: 16 };
    await env.engine.play([200], { owner: 'a', voice: sawtooth });

    // 16 harmonics at 200, 400, … 3200 Hz.
    const oscillators = env.context.oscillators;
    expect(oscillators).toHaveLength(16);
    expect(oscillators.map((o) => o.frequency.value)).toEqual(Array.from({ length: 16 }, (_, i) => 200 * (i + 1)));
    expect(oscillators.every((o) => o.type === 'sine')).toBe(true);
    expect(oscillators[0].startedAt).toBeCloseTo(10.01);

    // Gains: the note's envelope first, then one per harmonic, at its
    // amplitude times the loudness-matched scale.
    const [envelope, first, second] = env.context.gains;
    const scale = loudnessScale(partialsOf(sawtooth, 200));
    expect(first.gain.value).toBeCloseTo(1 * scale, 12);
    expect(second.gain.value).toBeCloseTo(0.5 * scale, 12);

    expect(oscillators[0].connectedTo).toBe(first);
    expect(first.connectedTo).toBe(envelope);
    expect(envelope.connectedTo).toBe(env.context.destination);
  });

  it('flips the phase of negative partials (the triangle recipe)', async () => {
    await env.engine.play([200], { owner: 'a', voice: { kind: 'harmonic', profile: 'triangle', partials: 3 } });

    const [, first, second, third] = env.context.gains;
    expect(first.gain.value).toBeGreaterThan(0);
    expect(second.gain.value).toBe(0);
    expect(third.gain.value).toBeLessThan(0);
  });

  it('plays any mix of partials', async () => {
    await env.engine.play([100], { owner: 'a', voice: { kind: 'partials', amplitudes: [0, 1, 0, 0.25] } });

    const levels = env.context.gains.slice(1).map((gain) => gain.gain.value);
    expect(levels[0]).toBe(0);
    expect(levels[1]).toBeGreaterThan(0);
    expect(levels[3]).toBeCloseTo(levels[1] / 4, 12);
  });

  it('fades in from silence, so starts never click', async () => {
    await env.engine.play([200], { owner: 'a' });

    const [first, second] = env.context.gains[0].gain.events;
    expect(first).toEqual(['set', 0, expect.closeTo(10.01)]);
    expect(second[0]).toBe('linear');
    expect(second[1]).toBeGreaterThan(0);
  });

  it('sustains until stopped, then fades out, stops and cleans up', async () => {
    const sound = await env.engine.play([200], {
      owner: 'a',
      voice: { kind: 'harmonic', profile: 'sawtooth', partials: 2 },
    });
    const oscillators = env.context.oscillators;
    const [envelope, ...partialGains] = env.context.gains;

    // Sustained: nothing scheduled to stop it yet.
    expect(oscillators.every((o) => o.stoppedAt === null)).toBe(true);

    env.context.currentTime = 12;
    sound.stop();

    expect(envelope.gain.events.slice(-2)).toEqual([
      ['cancelAndHold', 12],
      ['linear', 0, expect.closeTo(12.03)],
    ]);
    expect(oscillators.map((o) => o.stoppedAt)).toEqual([expect.closeTo(12.04), expect.closeTo(12.04)]);

    let finished = false;
    void sound.finished.then(() => (finished = true));

    // Not finished until every oscillator has ended.
    oscillators[0].end();
    await settle();
    expect(finished).toBe(false);

    oscillators[1].end();
    await settle();
    expect(finished).toBe(true);
    expect([...oscillators, envelope, ...partialGains].every((node) => node.disconnected)).toBe(true);
  });

  it('glides a playing sound to new frequencies and partial levels', async () => {
    const voice: Voice = { kind: 'partials', amplitudes: [1, 0.5] };
    const sound = await env.engine.play([200], { owner: 'a', voice });
    const [low, high] = env.context.oscillators;
    const [, lowGain, highGain] = env.context.gains;

    env.context.currentTime = 11;
    const newVoice: Voice = { kind: 'partials', amplitudes: [1, 0] };
    sound.update([300], newVoice);

    const scale = loudnessScale(partialsOf(newVoice, 300));
    expect(low.frequency.events.at(-1)).toEqual(['target', 300, 11, 0.012]);
    expect(high.frequency.events.at(-1)).toEqual(['target', 600, 11, 0.012]);
    expect(lowGain.gain.events.at(-1)).toEqual(['target', expect.closeTo(scale, 12), 11, 0.012]);
    expect(highGain.gain.events.at(-1)).toEqual(['target', 0, 11, 0.012]);
  });

  it('ends on its own after a duration, fading out first', async () => {
    await env.engine.play([200], { owner: 'a', duration: 1 });
    const [oscillator] = env.context.oscillators;

    expect(oscillator.stoppedAt).toBeCloseTo(11.02);
    expect(env.context.gains[0].gain.events.at(-1)).toEqual(['linear', 0, expect.closeTo(11.01)]);
  });

  it('lets a pluck fade away by itself', async () => {
    await env.engine.play([200], { owner: 'a', voice: { kind: 'pluck' } });

    const events = env.context.gains[0].gain.events.map(([kind]) => kind);
    expect(events).toEqual(['set', 'linear', 'exponential', 'exponential', 'target']);
    expect(env.context.oscillators[0].stoppedAt).toBeCloseTo(12.52);
  });

  it('plays one demo at a time: a new demo stops the others', async () => {
    await env.engine.play([200], { owner: 'harmonic-tone' });
    await env.engine.play([300], { owner: 'harmonic-tone' });
    const [first, second] = env.context.oscillators;

    // A demo can layer its own sounds...
    expect(first.stoppedAt).toBeNull();

    // ...but another demo starting stops them.
    await env.engine.play([400], { owner: 'scale-generator' });
    expect(first.stoppedAt).not.toBeNull();
    expect(second.stoppedAt).not.toBeNull();
  });

  it('stops when another embed on the page starts a sound', async () => {
    const peers: FakeChannel[] = [];
    const context = new FakeContext();
    const make = () =>
      new AudioEngine({
        createContext: () => context as unknown as AudioContext,
        document: null,
        window: null,
        channel: new FakeChannel(peers),
      });
    const embedA = make();
    const embedB = make();

    await embedA.play([200], { owner: 'a' });
    expect(context.oscillators[0].stoppedAt).toBeNull();

    await embedB.play([300], { owner: 'b' });
    expect(context.oscillators[0].stoppedAt).not.toBeNull();

    // An engine ignores its own announcement: B's sound (the second note's
    // 16 oscillators) keeps playing.
    expect(context.oscillators[16].stoppedAt).toBeNull();
  });

  it('stops everything when the page is hidden', async () => {
    await env.engine.play([200], { owner: 'a' });

    env.document.hide();

    expect(env.context.oscillators[0].stoppedAt).not.toBeNull();
  });

  it('stops everything and suspends audio when the page is closed', async () => {
    await env.engine.play([200], { owner: 'a' });

    env.window.dispatchEvent(new Event('pagehide'));

    expect(env.context.oscillators[0].stoppedAt).not.toBeNull();
    expect(env.context.suspended).toBe(true);
  });

  it('can stop just one demo', async () => {
    await env.engine.play([200], { owner: 'a' });

    env.engine.stopOwner('b');
    expect(env.context.oscillators[0].stoppedAt).toBeNull();

    env.engine.stopOwner('a');
    expect(env.context.oscillators[0].stoppedAt).not.toBeNull();
  });

  it('scales a chord as one sound, so it is as loud as a single note', async () => {
    const voice: Voice = { kind: 'harmonic', profile: 'sawtooth', partials: 2 };
    await env.engine.play([200, 300], { owner: 'a', voice });

    const scale = loudnessScale([...partialsOf(voice, 200), ...partialsOf(voice, 300)]);
    const fundamentals = env.context.gains.filter((_, i) => i % 3 === 1).map((gain) => gain.gain.value);
    expect(fundamentals).toEqual([expect.closeTo(scale, 12), expect.closeTo(scale, 12)]);
  });

  it('plays a struck tone with each harmonic on its own decay, ending after its duration', async () => {
    const voice: Voice = { kind: 'harmonic', profile: 'sawtooth', partials: 2 };
    await env.engine.play([200], { owner: 'a', voice, articulation: 'struck' });

    const [envelope, first, second] = env.context.gains;
    const scale = loudnessScale(partialsOf(voice, 200), 'struck');
    const start = 10.01;

    // The note's envelope just stays at full level.
    expect(envelope.gain.events).toEqual([['set', 1, start]]);

    // Each harmonic: strike, settle, decay at its own rate, fade out.
    expect(first.gain.events.map(([kind]) => kind)).toEqual([
      'set',
      'linear',
      'exponential',
      'target',
      'set',
      'linear',
    ]);
    expect(first.gain.events[1]).toEqual(['linear', expect.closeTo(scale * 1.5, 12), expect.closeTo(start + 0.003)]);
    expect(first.gain.events[3]).toEqual(['target', 0, expect.closeTo(start + 0.04), struckDecayTime(1)]);
    expect(second.gain.events[3]).toEqual(['target', 0, expect.closeTo(start + 0.04), struckDecayTime(2)]);
    expect(first.gain.events.at(-1)).toEqual(['linear', 0, expect.closeTo(start + 1)]);

    expect(env.context.oscillators.map((o) => o.stoppedAt)).toEqual([expect.closeTo(11.02), expect.closeTo(11.02)]);
  });
});
