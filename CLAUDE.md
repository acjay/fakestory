# Notes for AI agents

> 🤖 **Agent-written.** This document was written by an AI agent.

## Mark agent-written documents

Any document an agent writes, in this repository or in Notion, starts with a small header saying so, right below its title:

- Markdown in the repo: `> 🤖 **Agent-written.** This document was written by an AI agent.`
- Notion pages: a gray line at the top of the page, `🤖 Agent-written: this page was written by an AI agent.`

Keep the header when editing such a document. Don't add it to documents a person wrote.

## Pull requests

When new work builds on another pull request that hasn't merged yet, open a stacked pull request: target the earlier pull request's branch, not `main`, so its diff shows only the new work. Keep it up to date by merging the base branch into it, not by rebasing or force-pushing. Once the base merges, the stacked pull request targets `main`.

## Code style

Format with Prettier (`npm run format`). Favor readable code: blank lines between steps, descriptive names, and brief comments on intent.
