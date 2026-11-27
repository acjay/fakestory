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

   This writes `content/story.json` and the images in `content/images/`. If anything would make it incomplete, such as a footnote that can't be placed, it saves nothing and lists the problems instead. Fix them in Notion and run it again.

3. **Review the diff.** `git diff content/` shows exactly which text changed, and lists any added or changed images. The snapshot keeps only what the reader renders, so re-importing an unchanged story produces no diff.

4. **Commit, push and open a pull request.** Cloudflare builds a preview of the site with the new content, and comments on the pull request with its URL. Check the story there; push more commits if needed.

5. **Merge to publish.** Production rebuilds from `main` with the new story. To undo a publish, revert the merge.

Locally, `npm run dev` shows whatever `content/story.json` holds, so you can also look before pushing.

## Trying changes without publishing

Nothing reaches production until it's merged into `main`, so any branch can be a test:

- **Content only:** import on a branch, push it, and look at its preview. Every pushed branch gets one, with or without a pull request. Re-import and push to update it. If you decide not to publish, delete the branch or close the pull request.
- **Content and demos together:** put both on one branch. Demos embedded in the story render from the preview's own code, so the preview shows the new demo inside the current story. Notion's own embeds keep pointing at the production demos until you merge.
- **Shipping only part of it:** keep re-imports on `content/…` branches, and code changes on their own branches. That way you can merge a code change without publishing a test import, or the other way round.
- **Locally, without pushing:** `npm run import:notion`, then `npm run dev`. `git restore content/` puts the committed story back (`git clean -f content/images/` removes newly downloaded images). This is the only way to look at a draft without making it public.

## Good to know

- **Everything pushed is public.** The repository is open source, so a pushed branch's story, and its preview build, can be read by anyone who finds them, even before merging. Previews are kept out of search engines but aren't secret.
- **What's in the snapshot:** each block's ID, type, content and children; the title; and the footnotes (comments starting with "Footnote: "). Other comments, edit times and editor IDs are left out.
- **Images** are downloaded by the import into `content/images/`, named after their block, and committed with the story. The site serves its own copies, since Notion's links to uploaded files expire within the hour. Images the story no longer uses are deleted. An image's caption is also its text alternative for screen readers, so the import lists any image without one.
- **Before the first import**, there's no `content/story.json`, and the site shows the invented fixture story (`src/fixture.ts`).
