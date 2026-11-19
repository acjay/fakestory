# Content model and footnote investigation

## Source page observations

The story uses paragraphs with formatted rich text, headings, callouts, nested lists, inline equations, columns, synced blocks, tables, images, uploaded HTML and CodePen embeds. At least one actual top-level API response exceeded one 100-block page. Notion is a tree of blocks: rich-text spans are attributes inside a block, not separate blocks. Child block lists must be paginated and recursively retrieved. See [Working with page content](https://developers.notion.com/guides/data-apis/working-with-page-content).

## Comments as footnotes

The story's notes are currently Notion comments. Whether they can be migrated depends on recovering which text each comment is attached to.

### Where anchors are and aren't available

- **Block API (`GET /v1/blocks/{id}/children`): no anchors.** Rich-text annotations are only `bold`, `italic`, `strikethrough`, `underline`, `code` and `color`.
- **Comments API (`GET /v1/comments?block_id=...`): block only.** A comment has a `parent` (the page or block it's on) and a `discussion_id`, but no text range. Only **open** comments are listed; there is no parameter to include resolved ones. Requires the integration's comment-read capability. See the [comments guide](https://developers.notion.com/guides/data-apis/working-with-comments) and the [comment object](https://developers.notion.com/reference/comment-object).
- **Page Markdown API (`GET /v1/pages/{id}/markdown`): exact anchors.** Confirmed against the real story with an integration token and `Notion-Version: 2025-09-03`. Commented text is wrapped in a span:

  ```html
  As they say,
  <span discussion-urls="discussion://PAGE_ID/BLOCK_ID/DISCUSSION_ID">“the map is not the territory”.</span>
  ```

  The attribute can hold several comma-separated URLs when discussions overlap. The last segment of each URL is the `discussion_id` used by the comments API, so each anchored span can be joined to its comment text.

### Implications

- Footnotes can be imported from existing comments with exact anchors, using two public endpoints: page Markdown for the anchored spans, and the comments API for the note text.
- The page Markdown is a second representation of the content alongside the block tree. Either render from Markdown, or use it only to locate anchors and map them back onto blocks by block ID. Undecided.
- Resolved discussions can't be listed through the public API, so their text isn't retrievable that way. Spans for resolved discussions haven't been checked.
- Not every comment is a footnote: some are editorial notes (e.g. "Idea: ..."). The authoring convention still has to say which comments are publishable, for example a `Footnote:` prefix, which some comments already use.

## Before a real reader or preview

- Define stable page/heading IDs, glossary catalog and backreferences, reference validation and broken-link handling.
- Add support for lists, tables, callouts, synced blocks, images and all other needed content; do not silently drop unhandled blocks. Resolve Notion-hosted file expiry without making private URLs public.
- Rebuild demos and the shared audio settings. The prototype never executes source embeds.
- Render real content only inside a protected preview, with all content and assets protected. A static build, Git ignores, or an unprotected preview URL are not access controls.
- Explicit publishing must promote an approved snapshot, not deploy a fresh Notion fetch or every Git commit. No automated deployment is configured here.
