import { useSyncExternalStore } from 'react';

import { DEFAULT_TONE, toneStore, type ToneSettings } from '../audio/toneSettings';

/**
 * The shared tone settings, kept current: the component re-renders whenever
 * they change, in this demo, another demo, or another tab or embed.
 */
export function useToneSettings(): ToneSettings {
  const store = toneStore();
  return useSyncExternalStore(store.subscribe, store.get, () => DEFAULT_TONE);
}
