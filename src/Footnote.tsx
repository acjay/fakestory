import type { ReactNode } from 'react';

import { ReferencePopup } from './ReferencePopup';

type Props = {
  /** The anchored text, rendered as normal prose. */
  children: ReactNode;

  /** The footnote's content, shown in the popup. */
  note: ReactNode;
};

/**
 * Anchored text followed by a small ♪ marker. The marker is the always-visible
 * clue that there's a note; hovering the text or the marker, focusing the
 * marker, or opening the note highlights exactly which words it's attached to
 * (see `.footnote` in style.css).
 */
export function Footnote({ children, note }: Props) {
  return (
    <span className="footnote">
      <span className="footnote-anchor">{children}</span>
      <ReferencePopup
        label={<span aria-hidden="true">♪</span>}
        ariaLabel="Footnote"
        triggerClassName="footnote-marker"
        body={note}
      />
    </span>
  );
}
