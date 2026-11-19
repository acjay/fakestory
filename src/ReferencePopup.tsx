import { useId, useState, type ReactNode } from 'react';

type Props = {
  /** What's shown inline, and clicked to open the popup. */
  label: ReactNode;

  /** An accessible name for the button, when `label` alone isn't descriptive (e.g. an icon). */
  ariaLabel?: string;

  /** Extra class for the button, to style it differently (e.g. as an icon). */
  triggerClassName?: string;

  title?: string;
  body: ReactNode;
};

/**
 * An inline button that toggles a small popup, used for glossary terms and
 * footnotes. It's a real button, so it works with keyboard and touch; Escape
 * closes it.
 */
export function ReferencePopup({ label, ariaLabel, triggerClassName, title, body }: Props) {
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
        className={triggerClassName ?? 'reference-trigger'}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onClick={() => setOpen(!open)}
      >
        {label}
      </button>

      {open && (
        <span id={popupId} className="detail-body">
          {title && <strong>{title}</strong>}
          <span>{body}</span>
        </span>
      )}
    </span>
  );
}
