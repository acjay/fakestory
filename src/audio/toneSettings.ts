/**
 * The shared tone settings ("Create our tone"): the base frequency and the
 * timbre every demo plays with, chosen by the reader.
 *
 * Saved in the reader's browser, so they last between visits, and shared
 * live between every demo: on the same page, in other tabs, and in embeds of
 * the site (e.g. several demos in one Notion page), which share storage
 * because they come from the same site. Where storage is blocked (some
 * private modes and embeds), the settings still work for the current page.
 */

import { DEFAULT_BASE_FREQUENCY } from '../music/pitch';
import type { HarmonicProfile, Voice } from './voices';

export type ToneSettings = {
  /** α1, in hertz. Every demo's pitches are relative to it. */
  baseFrequency: number;

  /** Which harmonic recipe tones use. */
  profile: HarmonicProfile;

  /** How many harmonics tones use. */
  partials: number;
};

export const DEFAULT_TONE: ToneSettings = {
  baseFrequency: DEFAULT_BASE_FREQUENCY,
  profile: 'square',
  partials: 16,
};

export const TONE_LIMITS = {
  minFrequency: 80,
  maxFrequency: 400,
  minPartials: 1,
  maxPartials: 16,
};

const STORAGE_KEY = 'fakestory.tone';

const PROFILES: HarmonicProfile[] = ['sawtooth', 'square', 'triangle'];

/** The voice demos play notes with. */
export function toneVoice({ profile, partials }: ToneSettings): Voice {
  return { kind: 'harmonic', profile, partials };
}

/**
 * Make any value a valid ToneSettings: anything missing, out of range or
 * malformed (e.g. from an old version, or edited by hand) falls back to the
 * default for that field.
 */
export function normalizeTone(value: unknown): ToneSettings {
  const input = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const { minFrequency, maxFrequency, minPartials, maxPartials } = TONE_LIMITS;

  const frequency = Number(input.baseFrequency);
  const partials = Number(input.partials);

  return {
    baseFrequency:
      Number.isFinite(frequency) && frequency >= minFrequency && frequency <= maxFrequency
        ? Math.round(frequency)
        : DEFAULT_TONE.baseFrequency,
    profile: PROFILES.includes(input.profile as HarmonicProfile)
      ? (input.profile as HarmonicProfile)
      : DEFAULT_TONE.profile,
    partials:
      Number.isInteger(partials) && partials >= minPartials && partials <= maxPartials
        ? partials
        : DEFAULT_TONE.partials,
  };
}

export type ToneStore = {
  get(): ToneSettings;
  set(change: Partial<ToneSettings>): void;
  reset(): void;

  /** Call `listener` whenever the settings change, here or elsewhere. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
};

type StoreOptions = {
  /** Defaults to the browser's localStorage, if available. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;

  /** Where to listen for changes made in other tabs and embeds. Defaults to `window`. */
  window?: Pick<Window, 'addEventListener'> | null;
};

export function createToneStore(options: StoreOptions = {}): ToneStore {
  const storage = options.storage !== undefined ? options.storage : browserStorage();
  const win = options.window !== undefined ? options.window : globalThis.window;
  const listeners = new Set<() => void>();

  let current = read();

  function read(): ToneSettings {
    try {
      const saved = storage?.getItem(STORAGE_KEY);
      return normalizeTone(saved ? JSON.parse(saved) : null);
    } catch {
      return { ...DEFAULT_TONE };
    }
  }

  function write(settings: ToneSettings | null) {
    try {
      if (settings) {
        storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
      } else {
        storage?.removeItem(STORAGE_KEY);
      }
    } catch {
      // Storage blocked or full: the settings still apply to this page.
    }
  }

  function change(next: ToneSettings) {
    current = next;
    listeners.forEach((listener) => listener());
  }

  // Another tab or embed changed the settings.
  win?.addEventListener('storage', (event) => {
    if ((event as StorageEvent).key === STORAGE_KEY || (event as StorageEvent).key === null) {
      change(read());
    }
  });

  return {
    get: () => current,

    set(update) {
      const next = normalizeTone({ ...current, ...update });
      write(next);
      change(next);
    },

    reset() {
      write(null);
      change({ ...DEFAULT_TONE });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Accessing localStorage itself can throw when it's blocked.
    return null;
  }
}

let sharedStore: ToneStore | null = null;

/** The one tone store for this page, created on first use. */
export function toneStore(): ToneStore {
  sharedStore ??= createToneStore();
  return sharedStore;
}
