/**
 * Progress of a slide animation, from 0 to 1, restarting whenever `key`
 * changes while `animate` is true. Otherwise (and on the server, and for
 * readers who prefer reduced motion) it's 1: things are simply in place.
 */

import { useEffect, useState } from 'react';

export function useSlide(key: unknown, animate: boolean, duration: number): number {
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!animate || reduceMotion) {
      setProgress(1);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setProgress(easeInOut(t));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    setProgress(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Restart only for a new key; `animate` and `duration` are read when it changes.
  }, [key]);

  return progress;
}

/** Slow at both ends, like something set moving and coming to rest. */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
