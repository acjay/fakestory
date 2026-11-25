# Hosting and preview builds

> 🤖 **Agent-written.** This document was written by an AI agent.

The site is a static Cloudflare Worker: no server code, just the files `npm run build` produces in `dist/`, served by Cloudflare. [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) connects it to GitHub:

- **`main` deploys to production**, at `https://fakestory.<your-subdomain>.workers.dev`. It's public, and holds only what's in the repository: the reader with its invented fixture story, and the demos.
- **Every other branch gets a preview build** with its own URL, and pull requests get a comment linking to it. Previews are open to anyone with the link; they're kept out of search engines but aren't secret.

Builds show the story committed in `content/story.json` (or the invented fixture before the first import). The Notion import runs on your own machine, and Cloudflare never gets a Notion token. Publishing a content change works like a code change: see [publishing.md](publishing.md).

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
2. Choose `acjay/fakestory`. On **Set up your application**:
   - **Project name:** `fakestory` (must match `name` in `wrangler.jsonc`).
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy` (production, from `main`)
   - **Preview command:** `npx wrangler preview`, the default. It creates one named preview per branch, whose URL stays the same as the branch gets new commits. Worker Previews is in open beta; if it misbehaves, `npx wrangler versions upload` is the older, stable alternative (a new URL for every upload).
   - **Enable Preview builds:** on.
   - **Protect with Cloudflare Access:** optional. Leave it off for open previews, or turn it on to require sign-in (free for up to 50 users), then limit the policy to your email address.
3. Don't add any build variables or secrets. The build doesn't need any; in particular, never add a Notion token.
4. Deploy. The first production build runs from `main`.

### 2. Tell the repository the production address

Once production is live, add its host (e.g. `fakestory.<your-subdomain>.workers.dev`) to `DEMO_HOSTS` in `src/demos/registry.ts`. Story embeds pointing there then render as demos in every build, including previews, which have different hosts.

## Day to day

- Open a pull request: Cloudflare builds it and comments with the preview URL.
- Merge to `main`: production updates.
- A failed build doesn't replace what's live.

## Checking locally

`npm run build`, then `npx wrangler dev` serves `dist/` exactly as Cloudflare will, including `public/_headers`.

## Costs

Everything here fits the free plans (as of November 2026; check Cloudflare's current pricing pages):

- **Workers:** requests for static files are free and unlimited.
- **Builds:** 500 a month across the account, one at a time. Every push to a pull request branch is one build.
- **Access** (optional sign-in for previews): free for up to 50 users.

A custom domain is optional, and costs only the domain's registration.
