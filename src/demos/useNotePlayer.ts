/**
 * Plays one note or chord at a time for a demo, in the reader's shared tone, and keeps
 * track of what's sounding so the demo can highlight it and announce it.
 */

import { useEffect, useId, useRef, useState } from 'react';

import { audioEngine, AudioUnavailableError, type Sound } from '../audio/engine';
import { toneVoice } from '../audio/toneSettings';
import { useToneSettings } from './useToneSettings';

export type Playing = {
  /** Which note is sounding, so the view can highlight it. */
  id: string;

  /** What the status line says while it sounds. */
  text: string;
};

export function useNotePlayer() {
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const owner = useId();
  const sound = useRef<Sound | null>(null);
  const tone = useToneSettings();

  // Stop when the demo goes away.
  useEffect(() => () => sound.current?.stop(), []);

  /** Play a note or chord, struck like a string, replacing whatever this demo was playing. */
  async function play(frequencies: number | number[], now: Playing) {
    sound.current?.stop();
    setError(null);

    try {
      const started = await audioEngine().play([frequencies].flat(), {
        owner,
        voice: toneVoice(tone),
        articulation: 'struck',
      });
      sound.current = started;
      setPlaying(now);

      await started.finished;
      if (sound.current === started) {
        sound.current = null;
        setPlaying(null);
      }
    } catch (caught) {
      sound.current = null;
      setPlaying(null);
      setError(caught instanceof AudioUnavailableError ? caught.message : 'Audio could not start.');
    }
  }

  return { tone, playing, error, play };
}
