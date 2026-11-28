# Demos: embedding and fallbacks

> 🤖 **Agent-written.** This document was written by an AI agent.

The story's interactive demos are rebuilt as part of this site. Each one has its own page, which you can embed in Notion. When the story embeds that page, the site renders the demo itself, inside the story. This page covers how to embed demos, how the site treats every kind of embed, and what readers see when something isn't available.

## Where the demos are

- **`/demos/`** lists every demo with its embed URL and the URL parameters it accepts.
- **`/demos/<slug>/`** is a demo on its own, e.g. `/demos/harmonic-tone/`. This is the page to embed.
- **A header bar** tops every demo: "Demo:" and a short title, with the ♪ tone settings on the right. The title is the demo's name unless the URL's `title` parameter gives another, e.g. `?title=3’s a crowd`. Variants on the `/demos/` index include their titles.
- **URL parameters** set up a variant, e.g. `/demos/harmonic-tone/?through=1` starts with only the fundamental. The `/demos/` index lists each demo's parameters. Parameters that are missing or out of range fall back to the demo's defaults.

The list of demos lives in `src/demos/registry.ts`.

## Embedding a demo in Notion

1. Copy the demo's **production** URL from the `/demos/` index, e.g. `https://fakestory.alanjay1.workers.dev/demos/harmonic-tone/`, with any parameters.
2. In Notion, paste it and choose **Embed**. Drag the embed's bottom edge to fit the demo's height.
3. Put the title and explanation in ordinary Notion blocks around the embed, not inside the demo. That keeps the prose editable in Notion and part of the story's text.

Always embed the production URL, not a preview's. Previews come and go, and production is the host the site recognizes everywhere (see below).

Inside Notion, the embed runs the production demo. On the site, the story renders the demo from the site's own code. So a preview build shows a changed demo inside the story before it's merged, while Notion keeps showing the production version until you merge.

## How the site treats embeds

| Embed in the story                                                                                                                   | What readers see                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| One of our demo URLs: a `/demos/<slug>/` page on production, on a host in `DEMO_HOSTS`, or on the page's own host (local or preview) | The demo, rendered directly in the story with its URL parameters. No iframe.            |
| A `/demos/` URL for a demo that doesn't exist                                                                                        | A placeholder, as for any other embed.                                                  |
| Anything else: CodePen, uploaded HTML files, other sites                                                                             | A placeholder ("Interactive demo: not yet implemented"). The embed is **never loaded**. |

Never loading other embeds is deliberate. It keeps the site's security policy strict (only the site's own scripts), keeps third-party code off readers' devices, and makes it visible which demos still need rebuilding. The original CodePen demos' source is archived in `legacy-demos/`, as a reference for rebuilding them.

The site's pages can't be framed by other sites, but demo pages (`/demos/*`) can be framed anywhere, which Notion needs. They contain only demo code, no story text. See `public/_headers` and [hosting.md](hosting.md).

## Fallbacks

| Situation                                                                                          | What happens                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Before the reader interacts**                                                                    | No sound. Browsers only allow audio after a click, tap or key press, so the audio engine starts on the first Play.                                                                                                                                                 |
| **Audio blocked or unavailable** (no Web Audio, or the browser refuses)                            | The demo shows an error message where the playback status normally appears ("Audio is unavailable in this browser", or "Audio could not start. Please allow sound in your browser."). Everything else still works: graphs, the octave circle, tables and controls. |
| **Several demos on one page**, or in several Notion embeds                                         | Only one plays at a time: starting one stops the others, including in other embeds and tabs from the site.                                                                                                                                                         |
| **The page is hidden or closed** (switching tabs, locking the phone)                               | Sound stops.                                                                                                                                                                                                                                                       |
| **Tone settings** (base frequency and timbre, the ♪ button at the right of each demo's header bar) | Saved in the browser and shared live between demos on the site, in other tabs and in its embeds. **Reset** goes back to 200 Hz, square wave. A demo whose URL fixes a setting (e.g. `?fundamental=110`) uses that value instead.                                   |
| **Browser storage blocked** (some private modes and embeds)                                        | Tone settings still work, but only for the current page, and aren't remembered.                                                                                                                                                                                    |
| **Embeds versus the site**                                                                         | Browsers may keep an embed's storage separate from the site's own, so tone settings chosen on the site might not carry over to the demos embedded in Notion, and vice versa. Within each place, they're shared.                                                    |
| **Unknown demo page** (a `/demos/<slug>/` page with no registry entry)                             | The page says "Unknown demo".                                                                                                                                                                                                                                      |
| **JavaScript disabled**                                                                            | Demos don't render. The rest of the story also needs JavaScript today.                                                                                                                                                                                             |

## Desktop, phone and accessibility

Every demo works by mouse, touch and keyboard. Where a demo has keyboard shortcuts (Shift, Ctrl/⌘), it also has touch-friendly buttons that do the same. Controls and graphs have labels for screen readers, and graphs describe what they show in words.

## Adding a demo

1. Build it under `src/demos/<slug>/`, as a component that takes `params: URLSearchParams`.
2. Add it to `DEMOS` in `src/demos/registry.ts`, with a title, a one-line description and its parameters. These appear on the `/demos/` index.
3. Add `demos/<slug>/index.html`, copied from an existing demo, with `data-demo="<slug>"`. The build picks it up automatically.
4. After merging, embed its production URL in Notion. Embeds of it anywhere in the story now render the demo.
