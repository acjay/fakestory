# The Fake Story of Music

> 🤖 **Agent-written.** This document was written by an AI agent.

A first reading prototype for a Notion-backed site. The previous Fresh prototype is preserved on `archive/original-fresh`.

## Try the prototype

Requires Node 22.18 or later (scripts run as TypeScript via Node's built-in type stripping).

```sh
npm ci
npm test
npm run format:check
npm run build
npm run dev
```

Open the local URL printed by Vite. The page uses **invented fixture text**, not the story or a Notion snapshot. The demo panel is a placeholder; no audio is implemented. This is not the final design or a production renderer.

## Import from Notion locally (optional)

### Set up access

1. At [notion.so/profile/integrations](https://www.notion.so/profile/integrations), create an **internal** integration with only the **Read content** and **Read comments** capabilities. Nothing else is needed: the import never writes to Notion.
2. Open the story page, choose ··· → **Connections**, and add the integration. Connect it to the story page only; it can then read that page and its subpages, nothing else.
3. Set `NOTION_API_TOKEN` (the integration's secret) and `NOTION_PAGE_ID` in your local shell or secrets manager. Never paste a token into a ticket, commit, or chat. For example, `read -s NOTION_API_TOKEN && export NOTION_API_TOKEN` keeps it out of your shell history.

### Rotate the token

Rotate it if it may have been exposed, or periodically:

1. On the integration's page at [notion.so/profile/integrations](https://www.notion.so/profile/integrations), refresh (regenerate) the secret. The old secret stops working immediately.
2. Replace `NOTION_API_TOKEN` wherever it's stored, and run the import once to confirm the new one works.
3. If a token was exposed, also check the integration still has only the capabilities and page connections listed above.

### Run the import

```sh
npm run import:notion
```

This read-only script fetches the page's block tree, its Markdown and the comments on anchored blocks, then writes `~/.fakestory-private/story.json` with restrictive permissions, in the same shape the reader renders. Footnotes come from comments (see [the content-model notes](docs/content-model.md)). It prints progress, counts and problems by ID, never story text.

Temporary failures (rate limits, Notion server errors, dropped connections) are retried with backoff. Anything else, such as a wrong page ID or missing access, stops the import immediately.

**Incomplete imports are not saved.** If Notion's page Markdown is truncated or leaves out blocks, or a footnote can't be anchored to its text, the script lists the problems and exits with an error, leaving any previous snapshot unchanged. For local preview only, save it anyway with:

```sh
npm run import:notion -- --allow-incomplete
```

The snapshot can contain unpublished content and expiring asset URLs. Its directory is outside the repository and the Vite web root; it is never imported by the app or included in the build. Do not share or commit it. This is an import tool, not an automated content or publishing pipeline. Because failed or incomplete runs never overwrite the last good snapshot, an existing file may be older than your last attempt.

### Preview the imported story locally

```sh
npm run dev:story
```

This runs the dev server with the snapshot from `npm run import:notion` in place of the fixture. The dev server reads the file from `~/.fakestory-private/` on each request and only listens on 127.0.0.1. Production builds never include it: the loading code is stripped from `npm run build`, and `scripts/check-build.ts` fails the build if any trace of it remains. Blocks the reader doesn't support yet show a visible "Unsupported block" notice.

## Music model and audio engine

The shared code every rebuilt demo will use (see the demo design notes in Notion):

- `src/music/`: pure pitch math. Ratios and cents, notes as a pitch class plus an octave (α1 is the base, 200 Hz by default), Pythagorean pitch classes named in stacking order (α β γ δ …), equal temperament that wraps after its last step, and the gaps between pitch classes.
- `src/audio/voices.ts`: what notes sound like. The default voice is a sawtooth-like tone of 16 harmonics; there are also square- and triangle-like recipes and the plucked sound from the original CodePen demos.
- `src/audio/engine.ts`: plays them. Every sound, in any voice and whether a single note or a chord, is scaled to the same loudness (weighted for hearing, as in the original harmonic tone chart). Audio starts only from a user action, one demo sounds at a time (also across separate embeds of the site), every start and stop fades to avoid clicks, and sound stops when the page is hidden.

## Demos

Rebuilt demos live in `src/demos/`, one folder each, sharing the audio engine and `src/demos/demo.css`. Each has its own page at `/demos/<slug>/` (from `demos/<slug>/index.html`), which can be embedded in Notion. When the story embeds one of those URLs, the reader renders the demo directly; any other embed shows a placeholder and is never loaded. Query parameters on the URL configure the demo, so variants are set up in Notion.

`/demos/` lists every demo with its embed URL and parameters; it's generated from `src/demos/registry.ts`, where each demo is registered.

- `/demos/harmonic-tone/`: build a tone from up to 16 harmonics. "Play tone" plays a struck tone, each harmonic dying away at its own rate, as in the original demo. Parameters: `fundamental` (80–400 Hz, default 200), `profile` (`sawtooth`, `square` or `triangle`), `through` (1, 2, 4, 8 or 16 harmonics, default 4).

To try the engine by hand, run `npm run dev` and open `/harness/audio.html`. The harness is for development only and is not part of the build.

## What is and isn't here

- The renderer understands a small subset of Notion-shaped blocks and rich text: paragraphs, headings, bulleted and numbered lists (including nested), tables, callouts (with emoji icons), synced blocks, columns, equations, quotes, dividers, embeds (the rebuilt demos render; others show a placeholder), and links. Images are not rendered yet. Unsupported block types are visibly flagged.
- Footnotes render as a ♪ marker after the anchored text; hovering the text or marker highlights the anchor, and the marker opens the note. The importer builds them from Notion comments.
- The fixture demonstrates glossary definitions using explicit links and local records. This is a test convention, not a chosen authoring format. There is no glossary index or backreference system yet.
- Notion content is not automatically loaded or published. There is no deployment configuration, private preview, dashboard, or publish action. **Do not deploy this prototype as a preview for draft content.**
- See [the content-model notes](docs/content-model.md) for the API findings and remaining decisions.
