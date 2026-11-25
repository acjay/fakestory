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

Open the local URL printed by Vite. Until the story has been imported, the page shows **invented fixture text** (`src/fixture.ts`); after that, the committed story in `content/story.json`. The demo panel is a placeholder; no audio is implemented. This is not the final design or a production renderer.

## Hosting and preview builds

The site runs on Cloudflare as a static Worker. `main` deploys to production, and every pull request gets its own preview build. Setup and day-to-day use are in [docs/hosting.md](docs/hosting.md).

## Import from Notion

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

This read-only script fetches the page's block tree, its Markdown and the comments on anchored blocks, and writes the story to `content/story.json`, in the shape the reader renders. Footnotes come from comments (see [the content-model notes](docs/content-model.md)). It prints progress, counts and problems by ID, not story text.

Temporary failures (rate limits, Notion server errors, dropped connections) are retried with backoff. Anything else, such as a wrong page ID or missing access, stops the import immediately.

**Incomplete imports are not saved.** If Notion's page Markdown is truncated or leaves out blocks, or a footnote can't be anchored to its text, the script lists the problems and exits with an error, leaving `content/story.json` unchanged. To save it anyway for a look (not for publishing):

```sh
npm run import:notion -- --allow-incomplete
```

To publish what you imported, commit it on a branch and open a pull request: its preview build shows the story, and merging publishes it. See [docs/publishing.md](docs/publishing.md).

## What is and isn't here

- The renderer understands a small subset of Notion-shaped blocks and rich text: paragraphs, headings, bulleted and numbered lists (including nested), tables, callouts (with emoji icons), synced blocks, columns, equations, quotes, dividers, embeds (the rebuilt demos render; others show a placeholder), and links. Images are not rendered yet. Unsupported block types are visibly flagged.
- Footnotes render as a ♪ marker after the anchored text; hovering the text or marker highlights the anchor, and the marker opens the note. The importer builds them from Notion comments.
- The fixture demonstrates glossary definitions using explicit links and local records. This is a test convention, not a chosen authoring format. There is no glossary index or backreference system yet.
- Notion content is not automatically loaded or published. There is no deployment configuration, private preview, dashboard, or publish action. **Do not deploy this prototype as a preview for draft content.**
- See [the content-model notes](docs/content-model.md) for the API findings and remaining decisions.
