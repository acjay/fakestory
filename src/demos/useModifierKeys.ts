/**
 * Which modifier keys are held right now: Shift, and Ctrl or ⌘ ("down", as
 * the scale generator uses them). Cleared when the window loses focus, so
 * a key released elsewhere doesn't stay stuck.
 */

import { useEffect, useState } from 'react';

import type { Modifiers } from './views/OctaveCircle';

const NONE: Modifiers = { shift: false, down: false };

export function useModifierKeys(): Modifiers {
  const [held, setHeld] = useState<Modifiers>(NONE);

  useEffect(() => {
    const update = (event: KeyboardEvent) =>
      setHeld((current) => {
        const next = { shift: event.shiftKey, down: event.ctrlKey || event.metaKey };
        return next.shift === current.shift && next.down === current.down ? current : next;
      });
    const clear = () => setHeld(NONE);

    window.addEventListener('keydown', update);
    window.addEventListener('keyup', update);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', update);
      window.removeEventListener('keyup', update);
      window.removeEventListener('blur', clear);
    };
  }, []);

  return held;
}
