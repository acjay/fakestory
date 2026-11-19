# The Fake Story of Music

A first reading prototype for a Notion-backed site. The previous Fresh prototype is preserved on `archive/original-fresh`.

## Try the prototype

Requires Node 20 or later.

```sh
npm ci
npm test
npm run build
npm run dev
```

Open the local URL printed by Vite. The page uses **invented fixture text**, not the story or a Notion snapshot. The demo panel is a placeholder; no audio is implemented. This is not the final design or a production renderer.

## Inspect Notion locally (optional)

Grant a Notion integration read access to the source page, then set `NOTION_API_TOKEN` and `NOTION_PAGE_ID` in your local shell or secrets manager. Never paste a token into a ticket, commit, or chat. Run:

```sh
npm run inspect:notion
```

This read-only script fetches paginated children recursively and writes `~/.fakestory-private/notion-blocks.json` with restrictive permissions. It prints counts, not story text. The snapshot can contain unpublished content and expiring asset URLs. This directory is outside the repository and the Vite web root; it is never imported by the app or included in the build. Do not share or commit it. This is an inspection tool, not an automated content or publishing pipeline; it does not retrieve comments or images as files. Access requires the integration to be shared with the page. If a request fails, fix permissions and rerun. The script deliberately does not overwrite the last successful snapshot on failure, so do not mistake an older file for fresh data.

## What is and isn't here

- The renderer understands a small subset of Notion-shaped blocks and rich text: paragraphs, headings, columns, equations, quotes, dividers, embeds as placeholders, and links. Unsupported block types are visibly flagged.
- The fixture demonstrates glossary definitions and footnotes using explicit links and local records. This is a test convention, not a chosen production authoring format. There is no glossary index or backreference system yet.
- Notion content is not automatically loaded or published. There is no deployment configuration, private preview, dashboard, or publish action. **Do not deploy this prototype as a preview for draft content.**
- See [the content-model notes](docs/content-model.md) for the API findings and remaining decisions.
