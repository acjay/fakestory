import { describe, expect, it } from 'vitest';

import {
  activePreset,
  enabledThrough,
  fixedByUrl,
  formatAmplitude,
  mixSummary,
  mixValue,
  mixVoice,
  settingsFromParams,
  soloVoice,
} from './model';

const params = (query: string) => new URLSearchParams(query);

describe('harmonic tone settings from the embed URL', () => {
  it('default to the shared tone (200 Hz, square), through harmonic 4', () => {
    const settings = settingsFromParams(params(''));

    expect(settings.fundamental).toBe(200);
    expect(settings.profile).toBe('square');
    expect(activePreset(settings.enabled)).toBe(4);
  });

  it('start from the reader’s tone settings when the URL doesn’t set them', () => {
    const settings = settingsFromParams(params(''), { baseFrequency: 120, profile: 'triangle', partials: 8 });

    expect(settings).toMatchObject({ fundamental: 120, profile: 'triangle' });
  });

  it('read valid values, which take priority over the reader’s settings', () => {
    const settings = settingsFromParams(params('fundamental=110&profile=sawtooth&through=16'), {
      baseFrequency: 300,
      profile: 'square',
      partials: 16,
    });

    expect(settings).toMatchObject({ fundamental: 110, profile: 'sawtooth' });
    expect(activePreset(settings.enabled)).toBe(16);
    expect(fixedByUrl(params('fundamental=110&profile=sawtooth'))).toEqual({ fundamental: 110, profile: 'sawtooth' });
  });

  it('ignore invalid values, falling back to the shared tone', () => {
    const settings = settingsFromParams(params('fundamental=5000&profile=noise&through=3'));

    expect(settings).toMatchObject({ fundamental: 200, profile: 'square' });
    expect(activePreset(settings.enabled)).toBe(4);
    expect(fixedByUrl(params('fundamental=5000&profile=noise'))).toEqual({});
  });
});

describe('presets', () => {
  it('enable harmonics 1 to N', () => {
    expect(enabledThrough(2).slice(0, 4)).toEqual([true, true, false, false]);
  });

  it('only highlight when the selection matches exactly', () => {
    const custom = enabledThrough(4);
    custom[2] = false;

    expect(activePreset(enabledThrough(8))).toBe(8);
    expect(activePreset(custom)).toBeNull();
  });
});

describe('the mix', () => {
  const settings = { fundamental: 100, profile: 'sawtooth' as const, enabled: enabledThrough(4) };

  it('plays enabled harmonics at their profile amplitude', () => {
    const voice = mixVoice(settings);

    expect(voice.kind === 'partials' && voice.amplitudes.slice(0, 5)).toEqual([1, 0.5, 1 / 3, 0.25, 0]);
  });

  it('solos one harmonic at its amplitude, without changing the mix', () => {
    const voice = soloVoice(settings, 3);

    expect(voice.kind === 'partials' && voice.amplitudes.slice(0, 4)).toEqual([0, 0, 1 / 3, 0]);
    expect(activePreset(settings.enabled)).toBe(4);
  });

  it('draws the sum of the enabled harmonics', () => {
    // A quarter of the fundamental's period: harmonic 1 at its peak, 2 at zero,
    // 3 at its trough, 4 at zero.
    const t = 1 / 100 / 4;

    expect(mixValue(settings, t)).toBeCloseTo(1 - 1 / 3, 12);
  });

  it('summarizes how many harmonics are on', () => {
    expect(mixSummary(enabledThrough(1))).toBe('1 partial enabled');
    expect(mixSummary(enabledThrough(4))).toBe('4 partials enabled');
    expect(mixSummary(enabledThrough(0))).toBe('No partials enabled');
  });

  it('formats amplitudes for display', () => {
    expect(formatAmplitude(1 / 3)).toBe('0.33');
    expect(formatAmplitude(-1 / 9)).toBe('−0.11');
    expect(formatAmplitude(1)).toBe('1');
  });
});
