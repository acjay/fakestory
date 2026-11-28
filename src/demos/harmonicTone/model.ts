/**
 * The harmonic tone demo's state and math, separate from its UI so it can be
 * tested directly.
 *
 * The demo builds a tone from up to 16 harmonics of a fundamental. The reader
 * picks a harmonic profile (how loud each harmonic is), how many harmonics to
 * include, and can switch individual harmonics on and off or hear one alone.
 */

import { profileAmplitudes, type HarmonicProfile, type Voice } from '../../audio/voices';

export { PROFILE_LABELS } from '../../audio/voices';
import { DEFAULT_TONE, type ToneSettings } from '../../audio/toneSettings';

export const MAX_HARMONICS = 16;

/** The "through harmonic" presets: include harmonics 1 to N. */
export const PRESETS = [1, 2, 4, 8, 16] as const;

/** Harmonic rows shown before the reader asks for all 16. */
export const COLLAPSED_ROWS = 8;

export const MIN_FUNDAMENTAL = 80;
export const MAX_FUNDAMENTAL = 400;

/** The time window the graphs show, in seconds. */
export const GRAPH_WINDOW = 0.02;

export type HarmonicToneSettings = {
  fundamental: number;
  profile: HarmonicProfile;

  /** Which harmonics are included, index 0 being the fundamental. */
  enabled: boolean[];
};

/**
 * Starting settings from the embed URL's query parameters, so the author can
 * set up a variant in Notion, e.g. `?through=1` or `?profile=square`.
 * The fundamental and profile otherwise come from the reader's shared tone
 * settings; `through` defaults to 4.
 *
 *   fundamental  80–400 (Hz)
 *   profile      sawtooth | square | triangle
 *   through      1, 2, 4, 8 or 16 harmonics
 */
export function settingsFromParams(params: URLSearchParams, tone: ToneSettings = DEFAULT_TONE): HarmonicToneSettings {
  const through = Number(params.get('through'));
  const fixed = fixedByUrl(params);

  return {
    fundamental: fixed.fundamental ?? tone.baseFrequency,
    profile: fixed.profile ?? tone.profile,
    enabled: enabledThrough((PRESETS as readonly number[]).includes(through) ? through : 4),
  };
}

/**
 * The settings the embed URL fixes. Those stay put; the others follow the
 * reader's shared tone settings as they change.
 */
export function fixedByUrl(params: URLSearchParams): { fundamental?: number; profile?: HarmonicProfile } {
  const fundamental = Number(params.get('fundamental'));
  const profile = params.get('profile');

  return {
    fundamental:
      params.has('fundamental') && fundamental >= MIN_FUNDAMENTAL && fundamental <= MAX_FUNDAMENTAL
        ? fundamental
        : undefined,
    profile: profile === 'square' || profile === 'triangle' || profile === 'sawtooth' ? profile : undefined,
  };
}

/** Harmonics 1 to `through` on, the rest off. */
export function enabledThrough(through: number): boolean[] {
  return Array.from({ length: MAX_HARMONICS }, (_, i) => i < through);
}

/** The preset matching the current selection, if any (for highlighting it). */
export function activePreset(enabled: boolean[]): number | null {
  return PRESETS.find((preset) => enabled.every((on, i) => on === i < preset)) ?? null;
}

/** Each harmonic's amplitude in the chosen profile, enabled or not. */
export function profileLevels(profile: HarmonicProfile): number[] {
  return profileAmplitudes(profile, MAX_HARMONICS);
}

/** The voice for the current mix: the profile's amplitudes, with disabled harmonics silenced. */
export function mixVoice({ profile, enabled }: HarmonicToneSettings): Voice {
  const levels = profileLevels(profile);
  return { kind: 'partials', amplitudes: levels.map((level, i) => (enabled[i] ? level : 0)) };
}

/** The voice for one harmonic alone ("Solo"), at its amplitude in the profile. */
export function soloVoice({ profile }: HarmonicToneSettings, harmonic: number): Voice {
  const levels = profileLevels(profile);
  return { kind: 'partials', amplitudes: levels.map((level, i) => (i === harmonic - 1 ? level : 0)) };
}

/** E.g. "4 partials enabled". */
export function mixSummary(enabled: boolean[]): string {
  const count = enabled.filter(Boolean).length;
  return count === 0 ? 'No partials enabled' : `${count} partial${count === 1 ? '' : 's'} enabled`;
}

/** One harmonic's contribution at time `t` (seconds): amplitude × sine. */
export function harmonicValue(amplitude: number, harmonic: number, fundamental: number, t: number): number {
  return amplitude * Math.sin(2 * Math.PI * harmonic * fundamental * t);
}

/** The combined waveform at time `t`: the sum of the enabled harmonics. */
export function mixValue({ fundamental, profile, enabled }: HarmonicToneSettings, t: number): number {
  return profileLevels(profile).reduce(
    (sum, level, i) => (enabled[i] ? sum + harmonicValue(level, i + 1, fundamental, t) : sum),
    0,
  );
}

/** A tidy amplitude for display, e.g. 0.333 → "0.33", -0.111 → "−0.11". */
export function formatAmplitude(amplitude: number): string {
  const rounded = Math.round(amplitude * 100) / 100;
  return rounded < 0 ? `−${Math.abs(rounded)}` : String(rounded);
}
