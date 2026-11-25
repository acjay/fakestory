# Publishing the story

> 🤖 **Agent-written.** This document was written by an AI agent.

The story is written in Notion. The site shows the version committed to this repository, in `content/story.json`, so a content change works like a code change: import, preview in a pull request, merge to publish.

## Steps

1. **Start a branch** from an up-to-date `main`:

   ```sh
   git switch main && git pull && git switch -c content/2026-11-25
   ```

2. **Import** the story from Notion (setup is in the README):

   ```sh
   npm run import:notion
   ```

   This writes `content/story.json`. If anything would make it incomplete, such as a footnote that can't be placed, it saves nothing and lists the problems instead. Fix them in Notion and run it again.

3. **Review the diff.** `git diff content/story.json` shows exactly which text changed. The snapshot keeps only what the reader renders, so re-importing an unchanged story produces no diff.

4. **Commit, push and open a pull request.** Cloudflare builds a preview of the site with the new content, and comments on the pull request with its URL. Check the story there; push more commits if needed.

5. **Merge to publish.** Production rebuilds from `main` with the new story. To undo a publish, revert the merge.

Locally, `npm run dev` shows whatever `content/story.json` holds, so you can also look before pushing.

## Good to know

- **Everything pushed is public.** The repository is open source, so a pushed branch's story, and its preview build, can be read by anyone who finds them, even before merging. Previews are kept out of search engines but aren't secret.
- **What's in the snapshot:** each block's ID, type, content and children; the title; and the footnotes (comments starting with "Footnote: "). Other comments, edit times and editor IDs are left out.
- **Not yet:** images. Links to files uploaded to Notion expire within the hour, so they're removed from the snapshot for now; storing images is subtask 06.
- **Before the first import**, there's no `content/story.json`, and the site shows the invented fixture story (`src/fixture.ts`).
