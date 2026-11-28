import { useEffect, useId, useRef, useState } from 'react';

/**
 * Open/closed state for an inline popup (glossary terms, footnotes).
 *
 * While open, it closes on a click or tap anywhere outside `containerRef`,
 * or on Escape.
 */
export function usePopup<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<T>(null);
  const popupId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeIfOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeIfOutside);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeIfOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return { open, setOpen, toggle: () => setOpen((wasOpen) => !wasOpen), containerRef, popupId };
}
