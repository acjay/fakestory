# Content model and footnote investigation

## Source page observations

The story uses paragraphs with formatted rich text, headings, callouts, nested lists, inline equations, columns, synced blocks, tables, images, uploaded HTML and CodePen embeds. At least one actual top-level API response exceeded one 100-block page. Notion is a tree of blocks: rich-text spans are attributes inside a block, not separate blocks. Child block lists must be paginated and recursively retrieved. See [Working with page content](https://developers.notion.com/guides/data-apis/working-with-page-content).

## Comments as footnotes

A read-only check against one known text-anchored discussion succeeded: the paragraph's public API response returned seven rich-text spans, and listing that block's comments returned a matching discussion ID. In that example, the returned rich-text and comment fields did not identify the selected text range. This one observation is not proof about all comment cases, and no migration has been attempted.

The [comments guide](https://developers.notion.com/guides/data-apis/working-with-comments) says the public API lists **open** comments on a specified page or block, not resolved ones; listing is paginated and discussions are distinguished by `discussion_id`. [The comment object reference](https://developers.notion.com/reference/comment-object) documents parent and discussion ID but no text-range anchor. The API connection must have comment-read capability. Do not treat all comments as footnotes or assume every comment can be accurately mapped to its text.

Proposed fallback to review with the author: create explicit footnote identifiers and link the desired text to them, with note content in an editorial catalog. The fixture demonstrates the interaction using local synthetic data. A migration would require a way to select which comments are publishable, map anchors, preserve ordering, and handle resolved comments and updates. The final data model and authoring workflow remain open.

## Before a real reader or preview

- Define stable page/heading IDs, glossary catalog and backreferences, reference validation and broken-link handling.
- Add support for lists, tables, callouts, synced blocks, images and all other needed content; do not silently drop unhandled blocks. Resolve Notion-hosted file expiry without making private URLs public.
- Rebuild demos and the shared audio settings. The prototype never executes source embeds.
- Render real content only inside a protected preview, with all content and assets protected. A static build, Git ignores, or an unprotected preview URL are not access controls.
- Explicit publishing must promote an approved snapshot, not deploy a fresh Notion fetch or every Git commit. No automated deployment is configured here.
