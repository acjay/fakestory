import type { MouseEvent, ReactNode } from 'react';

import { usePopup } from './usePopup';

type Props = {
  /** The anchored text, rendered as normal prose. */
  children: ReactNode;

  /** The footnote's content, shown in the popup. */
  note: ReactNode;
};

/**
 * Anchored text followed by a small ♪ marker, behaving as one unit: clicking
 * anywhere on the text or the marker toggles the note, and hovering either
 * highlights both (see `.footnote` in style.css).
 *
 * The ♪ is the real button, so keyboard and screen-reader users get a single
 * focusable control. Clicking the text is a convenience for pointer users.
 */
export function Footnote({ children, note }: Props) {
  const { open, toggle, containerRef, popupId } = usePopup<HTMLSpanElement>();

  // One handler for the whole unit. Clicks on the ♪ button land here too, as
  // does pressing Enter or Space on it, since those fire a click that bubbles.
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element;

    // Clicks inside the open note shouldn't close it.
    if (target.closest('.detail-body')) {
      return;
    }

    // Links and glossary terms within the anchored text keep their own behavior.
    const control = target.closest('a, button');
    if (control && !control.classList.contains('footnote-marker')) {
      return;
    }

    // Don't toggle when the reader is selecting text.
    if (!window.getSelection()?.isCollapsed) {
      return;
    }

    toggle();
  };

  return (
    <span className="footnote" ref={containerRef} data-open={open || undefined} onClick={onClick}>
      {children}
      <span className="inline-detail">
        <button
          type="button"
          className="footnote-marker"
          aria-label="Footnote"
          aria-expanded={open}
          aria-controls={open ? popupId : undefined}
        >
          <span aria-hidden="true">♪</span>
        </button>

        {open && (
          <span id={popupId} className="detail-body">
            <span>{note}</span>
          </span>
        )}
      </span>
    </span>
  );
}
