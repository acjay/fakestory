import type { ReactNode } from 'react';

import { usePopup } from './usePopup';

type Props = {
  /** What's shown inline, and clicked to open the popup. */
  label: ReactNode;
  title: string;
  body: ReactNode;
};

/**
 * An inline button that toggles a small popup, used for glossary terms. It's a
 * real button, so it works with keyboard and touch. Clicking outside or
 * pressing Escape closes it.
 */
export function ReferencePopup({ label, title, body }: Props) {
  const { open, toggle, containerRef, popupId } = usePopup<HTMLSpanElement>();

  return (
    <span className="inline-detail" ref={containerRef}>
      <button
        type="button"
        className="reference-trigger"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onClick={toggle}
      >
        {label}
      </button>

      {open && (
        <span id={popupId} className="detail-body">
          <strong>{title}</strong>
          <span>{body}</span>
        </span>
      )}
    </span>
  );
}
