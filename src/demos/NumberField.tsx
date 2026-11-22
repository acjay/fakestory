import { useEffect, useState } from 'react';

type Props = {
  value: number;
  min: number;
  max: number;

  /** Called with each valid value as the reader types, within min–max. */
  onChange: (value: number) => void;

  'aria-label': string;
};

/**
 * A number input that doesn't fight the reader's typing. While they type a
 * partial value (e.g. "1" on the way to "150"), it's kept as a draft; valid
 * values are applied as soon as they're typed; leaving the field shows the
 * current value again.
 */
export function NumberField({ value, min, max, onChange, 'aria-label': ariaLabel }: Props) {
  const [draft, setDraft] = useState(String(value));

  // Follow changes made elsewhere, e.g. the slider next to it.
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={1}
      value={draft}
      aria-label={ariaLabel}
      onChange={(event) => {
        setDraft(event.target.value);
        const typed = Number(event.target.value);
        if (event.target.value !== '' && Number.isFinite(typed) && typed >= min && typed <= max) {
          onChange(Math.round(typed));
        }
      }}
      onBlur={() => setDraft(String(value))}
    />
  );
}
