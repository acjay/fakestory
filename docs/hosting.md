# Hosting and preview builds

> 🤖 **Agent-written.** This document was written by an AI agent.

The site is a static Cloudflare Worker: no server code, just the files `npm run build` produces in `dist/`, served by Cloudflare. [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) connects it to GitHub:

- **`main` deploys to production**, at `https://fakestory.<your-subdomain>.workers.dev`. It's public, and holds only what's in the repository: the reader with its invented fixture story, and the demos.
- **Every other branch gets a preview build** with its own URL, and pull requests get a comment linking to it. Previews require signing in with Cloudflare Access.

Draft story content never goes through these builds. The build uses only the fixture (`src/fixture.ts`); the Notion import runs only on your own machine, and Cloudflare never gets a Notion token. Previewing and publishing the real story will be a separate, explicit step (subtasks 19–21).

## What's in the repository

- `wrangler.jsonc`: the Worker. Its `name` must match the Worker's name in Cloudflare (`fakestory`).
- `public/_headers`: HTTP headers for every page.
  - A strict Content Security Policy: only the site's own scripts, styles, fonts and images.
  - `frame-ancestors`: demo pages (`/demos/*`) may be embedded anywhere, which Notion needs; every other page may only be framed by the site itself.
  - `X-Robots-Tag: noindex` everywhere until launch. `public/robots.txt` says the same.
- `.node-version`: the Node version builds use (22.18 or later, for the TypeScript build scripts).

## One-time setup in Cloudflare

You need a Cloudflare account; the free plan is enough (see Costs below).

### 1. Connect the repository

1. In the Cloudflare dashboard, go to **Workers & Pages**, choose **Create**, then **Import a repository**, and connect GitHub if asked.
2. Choose `acjay/fakestory`.
3. Settings:
   - **Project name:** `fakestory` (must match `name` in `wrangler.jsonc`).
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Production branch:** `main`
   - **Builds for non-production branches:** on, with the command `npx wrangler versions upload`. This is what creates preview builds.
4. Don't add any build variables or secrets. The build doesn't need any; in particular, never add a Notion token.
5. Save and deploy. The first production build runs from `main`.

### 2. Require sign-in for previews

Preview URLs are public by default, and they stay live after a branch is deleted, so lock them down:

1. Open the `fakestory` Worker, go to **Settings → Domains & Routes**, and under **Preview URLs** choose **Enable Cloudflare Access**. The first time, Cloudflare asks you to set up Zero Trust (free for up to 50 users).
2. That creates one Access policy, **Cloudflare Workers Preview URLs**, which covers the previews of every Worker in the account. Edit it in **Zero Trust → Access → Applications** to allow only your email address, or anyone else who should see previews.
3. Check it: open a preview URL in a private browser window. It should ask you to sign in.

Production stays public, so the demos can be embedded in Notion.

### 3. Tell the repository the production address

Once production is live, add its host (e.g. `fakestory.<your-subdomain>.workers.dev`) to `DEMO_HOSTS` in `src/demos/registry.ts`. Story embeds pointing there then render as demos in every build, including previews, which have different hosts.

## Day to day

- Open a pull request: Cloudflare builds it and comments with the preview URL. Sign in once to view it.
- Merge to `main`: production updates.
- A failed build doesn't replace what's live.

## Checking locally

`npm run build`, then `npx wrangler dev` serves `dist/` exactly as Cloudflare will, including `public/_headers`.

## Costs

Everything here fits the free plans (as of November 2026; check Cloudflare's current pricing pages):

- **Workers:** requests for static files are free and unlimited.
- **Builds:** 500 a month across the account, one at a time. Every push to a pull request branch is one build.
- **Access:** free for up to 50 users.

A custom domain is optional, and costs only the domain's registration.
