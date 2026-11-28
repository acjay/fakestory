/**
 * A waveform graph: a function of time drawn as a line, for a short window.
 * Shared by the demos that show what a sound looks like.
 *
 * It stretches to its container's width and keeps its line weight, so it
 * works from phone to desktop. Colors come from CSS (see demo.css).
 */

type Props = {
  /** The value to draw at time t, in seconds. */
  value: (t: number) => number;

  /** How many seconds the graph spans, starting at 0. */
  window: number;

  /** The vertical scale: values from −range to +range fill the height. */
  range: number;

  /** Highest frequency in the signal, in hertz, to choose how finely to sample. */
  highestFrequency: number;

  /** Describes the graph for screen readers. */
  label: string;

  height?: number;

  /** Draw dashed and muted, e.g. for a partial that's switched off. */
  muted?: boolean;
};

/** The drawing's internal width; it scales to the container. */
const WIDTH = 600;

export function WaveformPlot({ value, window, range, highestFrequency, label, height = 48, muted = false }: Props) {
  // About 10 points per cycle of the highest frequency, within sensible bounds.
  const samples = Math.min(2000, Math.max(200, Math.ceil(highestFrequency * window * 10)));

  const middle = height / 2;
  const points = Array.from({ length: samples + 1 }, (_, i) => {
    const t = (window * i) / samples;
    const x = (WIDTH * i) / samples;
    const y = middle - (value(t) / range) * (middle - 2);
    return `${x.toFixed(1)},${y.toFixed(2)}`;
  });

  return (
    <svg
      className={`waveform${muted ? ' waveform-muted' : ''}`}
      viewBox={`0 0 ${WIDTH} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      style={{ height }}
    >
      <line className="waveform-zero" x1={0} x2={WIDTH} y1={middle} y2={middle} vectorEffect="non-scaling-stroke" />
      <polyline className="waveform-line" points={points.join(' ')} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
