# Legacy CodePen demos

> 🤖 **Agent-written.** This document was written by an AI agent.

Source exported from the 13 CodePen demos the story currently embeds, kept as a reference for rebuilding them in this codebase. They are not part of the app: nothing here is built, tested, formatted or served.

Each folder holds one pen's `src/` (HTML, CSS, and TypeScript or JavaScript), its CodePen `README.md` with the original URL, and its MIT `LICENSE.txt`. CodePen's compiled `dist/` output was left out, since it's generated from `src/`.

Which story section embeds which pen is tracked privately in Notion, because the story is unpublished.

## The pens

| Folder | Pen | What it does | Sound |
| --- | --- | --- | --- |
| `our-base-tone` | [WNVQWKx](https://codepen.io/acjay/pen/WNVQWKx) | One button: "α1 @ 200Hz". | Plucks 200 Hz |
| `our-base-tone-octave-up` | [jOgbReV](https://codepen.io/acjay/pen/jOgbReV) | One button: "α2 @ 400Hz". | Plucks 400 Hz |
| `our-base-tone-octave-down` | [qBeOwJJ](https://codepen.io/acjay/pen/qBeOwJJ) | One button: "α0 @ 100Hz". | Plucks 100 Hz |
| `our-happy-interval-number-line-hertz` | [ogvBEdm](https://codepen.io/acjay/pen/ogvBEdm) | The α and β notes (100–600 Hz) on a number line spaced by frequency, labeled in Hz. | Click a note's label to pluck it |
| `our-happy-interval-number-line-cents` | [MYgJQgj](https://codepen.io/acjay/pen/MYgJQgj) | The same six notes on a number line spaced by cents, labeled −1200¢ to 1902¢. | None |
| `3-s-a-crowd` | [OPLWQGX](https://codepen.io/acjay/pen/OPLWQGX) | Cents number line with a step-through (⬅️ / ➡️): α1, then β1, then α2 and γ2, then γ1 folded back into the octave. | Click a note to pluck it |
| `two-note-harmonies` | [jOgWOvj](https://codepen.io/acjay/pen/jOgWOvj) | Two buttons: "α1 & γ1" and "α1 & β1". | Plucks both notes together |
| `the-quest-for-even-spacing` | [emOgMmj](https://codepen.io/acjay/pen/emOgMmj) | Cents number line of the 5-note set (α γ ε β δ, plus α2), with arcs labeled with each gap. | Click a note to pluck it |
| `pentatonic-pitch-circle-arc-labels` | [rNXOopG](https://codepen.io/acjay/pen/rNXOopG) | The 5-note set on an octave circle, with each gap labeled along the circle. | None (static drawing) |
| `onwards-to-7-tones-linear` | [zxONWwb](https://codepen.io/acjay/pen/zxONWwb) | The gap-arc number line with 7 notes (adds η and ζ). | Click a note to pluck it |
| `music-table-with-arcs` | [poMjpJy](https://codepen.io/acjay/pen/poMjpJy) | A table of the Greek-letter notes and their cents, with arcs over each +702¢ step and one +584¢ step. | None (static drawing) |
| `what-do-we-want-more-evenness` | [azopYEe](https://codepen.io/acjay/pen/azopYEe) | The gap-arc number line with 12 notes (adds θ ι κ λ μ). | Click a note to pluck it |
| `the-ever-tightening-circle` | [JjgEGOj](https://codepen.io/acjay/pen/JjgEGOj) | Scale generator: ➖ / ➕ change the scale size; each new note is a perfect fifth above the last, folded into the octave. Octave circle with gap labels, plus a table per scale size of biggest gap, smallest gap, number of gap sizes and their standard deviation. Starts at 12 notes. | Click a note to pluck it; Shift-click for an octave up, Ctrl/⌘-click for an octave down |

## What they share

- **One pluck synth, copied into 11 pens.** `playGuitarChord` builds a custom waveform of 10 harmonics with amplitudes falling as 1/n^0.8, darkens higher notes, scales volume by (440/f)^0.3, and applies a 2.5 s plucked envelope. Each pluck creates and later closes its own `AudioContext`.
- **One number-line view, in 6 pens.** Notes as labeled circles on a line, each with a label, frequency, cents and color; optionally a step-through, and arcs labeled with the gap to the next note. Only the data and the width change between pens.
- **One octave-circle view, in 2 pens.** Notes placed by cents around a circle, gaps labeled along an outer path.
- **Pythagorean tuning throughout.** Every Greek-letter note is a stack of 3:2 fifths from α1 = 200 Hz, folded into one octave. Most pens hard-code the results, for example `freq: 213.57421875, cents: 114`; the generator computes them.

## What the rebuild needs to change

- **No runtime CDN.** 11 pens import React from `esm.sh` when the page loads. The rebuilt demos bundle everything, per the embed contract.
- **Fit narrow screens.** The views have fixed widths (400, 800 and 1200px), so they overflow phones.
- **Keyboard and screen-reader access.** Notes are clickable SVG circles and text that can't be focused or announced, and the ⬅️ ➡️ ➖ ➕ buttons have no text labels. Shift/⌘-click for octaves has no keyboard or touch equivalent.
- **Stopping sound.** There's no stop control, and sound doesn't stop when the page is hidden.
- **Derive, don't hard-code.** Compute notes from the base frequency and the number of stacked fifths, so they follow the shared tone setting (default 200 Hz, as these pens already use).
- **Consistency.** The hertz number line builds its SVG by hand although it imports React, and the cents number line's notes don't play while the others' do.
- **Small bug.** In `pentatonic-pitch-circle-arc-labels`, a comment says the last gap is 90 cents, but it (correctly) draws +294.

## How they map onto shared components

| Shared component | Replaces |
| --- | --- |
| Note button(s) | The 3 base-tone pens, two-note harmonies |
| Number line (hertz or cents; optional steps and gap arcs) | The 2 number-line pens, 3's a crowd, the quest for even spacing, 7 tones, 12 tones |
| Octave circle (optional gap labels and scale-size control) | Pentatonic circle, the ever-tightening circle, and the missing 7-note circle |
| Interval table with arcs | Music table with arcs |

With a shared note model (Pythagorean stacking from a base frequency), each of the 13 pens becomes one of four components plus a small configuration.
