import { describe, expect, it } from 'vitest';

import { createToneStore, DEFAULT_TONE, normalizeTone, toneVoice } from './toneSettings';

class FakeStorage {
  items = new Map<string, string>();

  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

/** Storage that refuses everything, as in some private modes and embeds. */
const blockedStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('tone settings', () => {
  it('default to 200 Hz, square, 16 harmonics', () => {
    expect(DEFAULT_TONE).toEqual({ baseFrequency: 200, profile: 'square', partials: 16 });
    expect(toneVoice(DEFAULT_TONE)).toEqual({ kind: 'harmonic', profile: 'square', partials: 16 });
  });

  it('fix anything invalid, field by field', () => {
    expect(normalizeTone({ baseFrequency: 9000, profile: 'noise', partials: 3 })).toEqual({
      ...DEFAULT_TONE,
      partials: 3,
    });
    expect(normalizeTone({ baseFrequency: '110.4', partials: 2.5 })).toEqual({
      ...DEFAULT_TONE,
      baseFrequency: 110,
    });
    expect(normalizeTone(null)).toEqual(DEFAULT_TONE);
  });

  it('are remembered in the browser', () => {
    const storage = new FakeStorage();
    createToneStore({ storage, window: null }).set({ baseFrequency: 150, profile: 'triangle' });

    // A later visit (a new store on the same storage) gets them back.
    expect(createToneStore({ storage, window: null }).get()).toEqual({
      baseFrequency: 150,
      profile: 'triangle',
      partials: 16,
    });
  });

  it('ignore saved data that is not valid', () => {
    const storage = new FakeStorage();
    storage.setItem('fakestory.tone', '{not json');

    expect(createToneStore({ storage, window: null }).get()).toEqual(DEFAULT_TONE);
  });

  it('reset to the defaults, and forget what was saved', () => {
    const storage = new FakeStorage();
    const store = createToneStore({ storage, window: null });
    store.set({ baseFrequency: 300 });

    store.reset();

    expect(store.get()).toEqual(DEFAULT_TONE);
    expect(storage.getItem('fakestory.tone')).toBeNull();
  });

  it('tell demos on the page when they change', () => {
    const store = createToneStore({ storage: new FakeStorage(), window: null });
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);

    store.set({ partials: 4 });
    unsubscribe();
    store.set({ partials: 8 });

    expect(calls).toBe(1);
  });

  it('follow changes made in another tab or embed', () => {
    const storage = new FakeStorage();
    const window = new EventTarget();
    const store = createToneStore({ storage, window: window as unknown as Window });
    let calls = 0;
    store.subscribe(() => calls++);

    // Another document on the same site writes, and the browser fires `storage` here.
    storage.setItem('fakestory.tone', JSON.stringify({ baseFrequency: 120, profile: 'sawtooth', partials: 8 }));
    window.dispatchEvent(Object.assign(new Event('storage'), { key: 'fakestory.tone' }));

    expect(store.get()).toEqual({ baseFrequency: 120, profile: 'sawtooth', partials: 8 });
    expect(calls).toBe(1);
  });

  it('still work for the page when storage is blocked', () => {
    const store = createToneStore({ storage: blockedStorage, window: null });

    expect(store.get()).toEqual(DEFAULT_TONE);
    store.set({ baseFrequency: 250 });
    expect(store.get().baseFrequency).toBe(250);
  });
});
