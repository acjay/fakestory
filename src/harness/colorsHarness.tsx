/**
 * A development-only page for judging the pitch colors by eye: open
 * /harness/colors.html while `npm run dev` is running. Shows the 12 anchors,
 * the continuous blend around the octave, the comma, and everything again as
 * seen with common color-vision deficiencies. Tune the palette in
 * src/music/colors.ts.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { colorForCents, labToLinearRgb, linearRgbToLab } from '../music/colors';
import { PYTHAGOREAN_COMMA_CENTS, pythagoreanPitchClasses } from '../music/pitchClasses';

type Vision = { name: string; matrix: number[][] | null };

/** Simulated color-vision deficiencies (Machado et al. 2009, full severity). */
const VISIONS: Vision[] = [
  { name: 'Typical vision', matrix: null },
  {
    name: 'Protanopia (no red cones)',
    matrix: [
      [0.152286, 1.052583, -0.204868],
      [0.114503, 0.786281, 0.099216],
      [-0.003882, -0.048116, 1.051998],
    ],
  },
  {
    name: 'Deuteranopia (no green cones)',
    matrix: [
      [0.367322, 0.860646, -0.227968],
      [0.280085, 0.672501, 0.047413],
      [-0.01182, 0.04294, 0.968881],
    ],
  },
  {
    name: 'Tritanopia (no blue cones)',
    matrix: [
      [1.255528, -0.076749, -0.178779],
      [-0.078411, 0.930809, 0.147602],
      [0.004733, 0.691367, 0.3039],
    ],
  },
];

/** A pitch's color as seen with a given vision, as CSS. */
function seen(cents: number, vision: Vision): string {
  const color = colorForCents(cents);
  if (!vision.matrix) {
    return color.css;
  }

  const rgb = labToLinearRgb(color.lab).map((c) => Math.min(1, Math.max(0, c)));
  const simulated = vision.matrix.map((row) =>
    Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])),
  );
  const [r, g, b] = labToLinearRgb(linearRgbToLab(simulated as [number, number, number])).map((c) =>
    Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055)),
  );
  return `rgb(${r} ${g} ${b})`;
}

const anchors = pythagoreanPitchClasses(12).sort((a, b) => a.cents - b.cents);

function ColorsHarness() {
  return (
    <main style={{ font: '15px/1.5 system-ui, sans-serif', maxWidth: 900, margin: '32px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 24 }}>Pitch colors</h1>
      <p>Development only. The 12 Pythagorean pitch classes in semitone order, and the blend between them.</p>

      {VISIONS.map((vision) => (
        <section key={vision.name} style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16 }}>{vision.name}</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
            {anchors.map((pitchClass) => {
              const color = colorForCents(pitchClass.cents);
              return (
                <div
                  key={pitchClass.id}
                  style={{
                    background: seen(pitchClass.cents, vision),
                    color: color.text,
                    borderRadius: 6,
                    padding: '10px 0',
                    textAlign: 'center',
                    fontWeight: 600,
                  }}
                >
                  <div style={{ fontSize: 18 }}>{pitchClass.name}</div>
                  <div style={{ fontSize: 11 }}>{Math.round(pitchClass.cents)}¢</div>
                </div>
              );
            })}
          </div>

          {/* The continuous blend around the octave, every 5 cents. */}
          <div style={{ display: 'flex', height: 24, marginTop: 4, borderRadius: 6, overflow: 'hidden' }}>
            {Array.from({ length: 240 }, (_, i) => (
              <div key={i} style={{ flex: 1, background: seen(i * 5, vision) }} />
            ))}
          </div>
        </section>
      ))}

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16 }}>The comma</h2>
        <p>α, and the 13th fifth, which lands {PYTHAGOREAN_COMMA_CENTS.toFixed(1)}¢ above it.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, PYTHAGOREAN_COMMA_CENTS].map((cents) => {
            const color = colorForCents(cents);
            return (
              <div
                key={cents}
                style={{ background: color.css, color: color.text, width: 120, padding: 16, borderRadius: 6 }}
              >
                {cents === 0 ? 'α' : 'ν (13th fifth)'}
                <br />
                <code>{color.css}</code>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColorsHarness />
  </StrictMode>,
);
