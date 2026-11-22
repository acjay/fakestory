/**
 * Pitch colors: a consistent color for every pitch, across all demos.
 *
 * Twelve anchor colors, one per Pythagorean pitch class, sit in semitone
 * order on one closed loop through the OKLCH color space (perceptually
 * even, so equal steps look like equal steps):
 *
 *   - Hue advances with pitch: 0.3° per cent, starting from α. The circle is
 *     rotated so the two sides of the octave circle look different (see
 *     HUE_START), not like a single gradient from top to bottom.
 *   - Lightness alternates between neighbors in semitone order. Equal
 *     lightness looks calmer, but makes some neighbors nearly identical for
 *     readers with color-vision deficiencies; alternating fixes that.
 *   - Chroma (saturation) is capped where a hue can't reach it on screen.
 *
 * Any other pitch, such as a 13th fifth or a note in another tuning, gets a
 * blend of its two neighboring anchors, by distance in cents. So the color
 * between two neighbors is always a mix of those two, never an unrelated
 * color, and a pitch near an anchor looks near that anchor's color.
 *
 * Color is never the only cue: notes are always labeled too. See the demo
 * design notes in Notion.
 */

import { CENTS_PER_OCTAVE, foldCents } from './pitch';
import { pythagoreanPitchClasses } from './pitchClasses';

/**
 * Hue of α, in degrees: a purple-magenta. Chosen so the warm (orange) to
 * cool (blue) contrast runs from the right side of the octave circle to the
 * left. That contrast survives red-green color blindness, so the two sides
 * never look like mirror images; red versus green ends up top to bottom,
 * where the alternating lightness keeps neighbors apart.
 */
const HUE_START = 325;

/** Hue advance per cent: a full turn per octave. */
const HUE_PER_CENT = 360 / CENTS_PER_OCTAVE;

/** Lightness of even and odd anchors, in semitone order (α is even). */
const LIGHTNESS = [0.58, 0.72] as const;

/** The most saturation any anchor gets. */
const MAX_CHROMA = 0.14;

type Lab = [l: number, a: number, b: number];

export type PitchColor = {
  /** CSS color, e.g. "#a36e09". */
  css: string;

  /** Black or white, whichever reads better on top of this color. */
  text: '#000000' | '#ffffff';

  /** The color in OKLab, for blending and comparing. */
  lab: Lab;
};

/** The 12 anchors, in semitone order: their cents and OKLab colors. */
export const ANCHORS: { cents: number; lab: Lab }[] = pythagoreanPitchClasses(12)
  .map((pitchClass) => pitchClass.cents)
  .sort((a, b) => a - b)
  .map((cents, i) => {
    const lightness = LIGHTNESS[i % 2];
    const hue = (HUE_START + cents * HUE_PER_CENT) % 360;
    const chroma = Math.min(MAX_CHROMA, maxChromaInGamut(lightness, hue));
    return { cents, lab: fromOklch(lightness, chroma, hue) };
  });

/** The color for a pitch, given its cents above α (any octave). */
export function colorForCents(cents: number): PitchColor {
  const folded = foldCents(cents);

  // The anchors on either side, wrapping from the last back to α.
  const nextIndex = ANCHORS.findIndex((anchor) => anchor.cents > folded);
  const after = nextIndex === -1 ? 0 : nextIndex;
  const before = (after - 1 + ANCHORS.length) % ANCHORS.length;

  const from = ANCHORS[before];
  const to = ANCHORS[after];
  const span = foldCents(to.cents - from.cents) || CENTS_PER_OCTAVE;
  const t = foldCents(folded - from.cents) / span;

  return describe(mix(from.lab, to.lab, t));
}

// ---------------------------------------------------------------------------
// Color math: OKLab/OKLCH ⇄ sRGB (Björn Ottosson's published conversions)
// ---------------------------------------------------------------------------

function fromOklch(lightness: number, chroma: number, hueDegrees: number): Lab {
  const hue = (hueDegrees * Math.PI) / 180;
  return [lightness, chroma * Math.cos(hue), chroma * Math.sin(hue)];
}

function mix(a: Lab, b: Lab, t: number): Lab {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** OKLab → linear sRGB (components may fall outside 0–1 if out of gamut). */
export function labToLinearRgb([l, a, b]: Lab): [number, number, number] {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

/** Linear sRGB → OKLab. */
export function linearRgbToLab([r, g, b]: [number, number, number]): Lab {
  const cbrt = (x: number) => Math.sign(x) * Math.abs(x) ** (1 / 3);
  const l = cbrt(0.4122214708 * r + 0.536328886 * g + 0.0514459929 * b);
  const m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function inGamut(rgb: number[]): boolean {
  return rgb.every((channel) => channel >= -1e-6 && channel <= 1 + 1e-6);
}

/** The most chroma a lightness and hue can have and still display in sRGB. */
function maxChromaInGamut(lightness: number, hue: number): number {
  let low = 0;
  let high = 0.4;
  for (let i = 0; i < 30; i++) {
    const middle = (low + high) / 2;
    if (inGamut(labToLinearRgb(fromOklch(lightness, middle, hue)))) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return low;
}

function describe(lab: Lab): PitchColor {
  const rgb = labToLinearRgb(lab).map((channel) => Math.min(1, Math.max(0, channel)));
  const encode = (channel: number) =>
    Math.round(255 * (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055));
  const css = `#${rgb.map((channel) => encode(channel).toString(16).padStart(2, '0')).join('')}`;

  // Pick the text color with the better WCAG contrast.
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const onBlack = (luminance + 0.05) / 0.05;
  const onWhite = 1.05 / (luminance + 0.05);

  return { css, text: onBlack >= onWhite ? '#000000' : '#ffffff', lab };
}

/** WCAG contrast ratio between a pitch color and its text color. */
export function textContrast(color: PitchColor): number {
  const rgb = labToLinearRgb(color.lab).map((channel) => Math.min(1, Math.max(0, channel)));
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return color.text === '#000000' ? (luminance + 0.05) / 0.05 : 1.05 / (luminance + 0.05);
}
