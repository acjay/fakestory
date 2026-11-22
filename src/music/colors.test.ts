import { describe, expect, it } from 'vitest';

import { ANCHORS, colorForCents, labToLinearRgb, linearRgbToLab, textContrast } from './colors';
import { PYTHAGOREAN_COMMA_CENTS, pythagoreanPitchClasses } from './pitchClasses';

type Lab = [number, number, number];

/** Color difference in OKLab. About 0.02 is just noticeable. */
const difference = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Simulated color-vision deficiencies (Machado et al. 2009, full severity, linear RGB). */
const DEFICIENCIES = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function simulate(lab: Lab, matrix: number[][]): Lab {
  const rgb = labToLinearRgb(lab);
  const seen = matrix.map((row) => Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])));
  return linearRgbToLab(seen as [number, number, number]);
}

/** Smallest difference between neighboring anchors (in semitone order, wrapping around). */
function weakestNeighbors(see: (lab: Lab) => Lab = (lab) => lab): number {
  return Math.min(
    ...ANCHORS.map((anchor, i) => difference(see(anchor.lab), see(ANCHORS[(i + 1) % ANCHORS.length].lab))),
  );
}

describe('pitch colors', () => {
  it('give each of the 12 Pythagorean pitch classes its own anchor color', () => {
    const colors = pythagoreanPitchClasses(12).map((pitchClass) => colorForCents(pitchClass.cents).css);

    expect(new Set(colors).size).toBe(12);
    expect(colorForCents(0).css).toBe('#a36e09'); // α, an amber
  });

  it('keep neighboring semitones clearly distinct', () => {
    expect(weakestNeighbors()).toBeGreaterThan(0.14);
  });

  it('keep neighbors distinct under color-vision deficiencies too', () => {
    for (const [name, matrix] of Object.entries(DEFICIENCIES)) {
      expect(
        weakestNeighbors((lab) => simulate(lab, matrix)),
        name,
      ).toBeGreaterThan(0.11);
    }
  });

  it('are all displayable on an ordinary screen', () => {
    for (const anchor of ANCHORS) {
      expect(labToLinearRgb(anchor.lab).every((channel) => channel >= -1e-6 && channel <= 1 + 1e-6)).toBe(true);
    }
  });

  it('blend between neighbors, never through an unrelated color', () => {
    const [α, θ] = ANCHORS;
    const halfway = colorForCents((α.cents + θ.cents) / 2).lab;

    // Exactly on the line between the two anchors, at its middle.
    expect(difference(halfway, α.lab)).toBeCloseTo(difference(α.lab, θ.lab) / 2, 9);
    expect(difference(halfway, θ.lab)).toBeCloseTo(difference(α.lab, θ.lab) / 2, 9);
  });

  it('shift visibly but modestly for a comma: the 13th fifth looks like α, but not quite', () => {
    const shift = difference(colorForCents(PYTHAGOREAN_COMMA_CENTS).lab, colorForCents(0).lab);

    expect(shift).toBeGreaterThan(0.02);
    expect(shift).toBeLessThan(0.05);
  });

  it('are the same in every octave', () => {
    expect(colorForCents(702 + 1200).css).toBe(colorForCents(702).css);
    expect(colorForCents(702 - 1200).css).toBe(colorForCents(702).css);
  });

  it('come with readable label text', () => {
    for (const anchor of ANCHORS) {
      expect(textContrast(colorForCents(anchor.cents))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
