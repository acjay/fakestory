import { useId, useState, type ReactNode } from 'react';

type Props = {
  /** The inline text that opens the popup. */
  label: ReactNode;
  title: string;
  body: string;
};

/**
 * Inline text that toggles a small popup, used for glossary terms and
 * footnotes. It's a real button, so it works with keyboard and touch; Escape
 * closes it.
 */
export function ReferencePopup({ label, title, body }: Props) {
  const [open, setOpen] = useState(false);
  const popupId = useId();

  return (
    <span
      className="inline-detail"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="reference-trigger"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onClick={() => setOpen(!open)}
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
