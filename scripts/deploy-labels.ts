/**
 * Labels a merged pull request with the state of its production deploy:
 * `deploying` while Cloudflare builds and deploys `main`, then `deployed`
 * or `deploy failed`. So the pull request shows when its change is live.
 *
 * Cloudflare's Workers Builds deploys `main` and reports each build as a
 * check on the commit. .github/workflows/deploy-labels.yml runs this when
 * one of its checks changes, with GITHUB_TOKEN, GITHUB_REPOSITORY and
 * COMMIT_SHA set.
 *
 * Events can't be trusted for the state: Cloudflare may post a second,
 * already-finished check at the end of a deploy, and runs for those events
 * can finish in any order. So each run reads Cloudflare's latest check on
 * the commit and labels from that, and the workflow runs them one at a time.
 */

import { createGitHub } from './github.ts';

export const LABELS = {
  deploying: { name: 'deploying', color: 'fbca04', description: 'Deploying to production' },
  deployed: { name: 'deployed', color: '0e8a16', description: 'Deployed to production' },
  failed: { name: 'deploy failed', color: 'b60205', description: 'The production deploy failed' },
};

type LabelName = (typeof LABELS)[keyof typeof LABELS]['name'];

/** The app whose checks are Cloudflare's builds. */
export const CLOUDFLARE_APP = 'cloudflare-workers-and-pages';

export type CheckRun = { id: number; status: string; conclusion: string | null; app: { slug: string } | null };

/**
 * Which labels to add and remove, from Cloudflare's latest check on the
 * commit (its highest ID). A deploy that's cancelled or skipped, e.g.
 * replaced by a newer one, just loses `deploying`. No check: no change.
 */
export function labelChanges(checkRuns: CheckRun[]): { add?: LabelName; remove: LabelName[] } {
  const all: LabelName[] = Object.values(LABELS).map((label) => label.name);
  const only = (kept: LabelName) => ({ add: kept, remove: all.filter((name) => name !== kept) });

  const latest = checkRuns
    .filter((run) => run.app?.slug === CLOUDFLARE_APP)
    .reduce<CheckRun | null>((newest, run) => (newest === null || run.id > newest.id ? run : newest), null);

  if (!latest) {
    return { remove: [] };
  }
  if (latest.status !== 'completed') {
    return only(LABELS.deploying.name);
  }
  if (latest.conclusion === 'success') {
    return only(LABELS.deployed.name);
  }
  if (latest.conclusion === 'failure' || latest.conclusion === 'timed_out' || latest.conclusion === 'action_required') {
    return only(LABELS.failed.name);
  }
  return { remove: [LABELS.deploying.name] };
}

async function main() {
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, COMMIT_SHA } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !COMMIT_SHA) {
    throw new Error('Set GITHUB_TOKEN, GITHUB_REPOSITORY and COMMIT_SHA.');
  }

  const github = createGitHub(GITHUB_TOKEN, GITHUB_REPOSITORY);

  // 1. The pull request this commit merged. A direct push to main has none.
  type PullRequest = { number: number; merge_commit_sha: string | null };
  const pulls = await github.call<PullRequest[]>('GET', `/commits/${COMMIT_SHA}/pulls`);
  const merged = pulls.filter((pull) => pull.merge_commit_sha === COMMIT_SHA);
  if (merged.length === 0) {
    console.log(`No merged pull request for ${COMMIT_SHA}: nothing to label.`);
    return;
  }

  // 2. The deploy's current state, from Cloudflare's checks on the commit.
  const { check_runs: checkRuns } = await github.call<{ check_runs: CheckRun[] }>(
    'GET',
    `/commits/${COMMIT_SHA}/check-runs?per_page=100`,
  );
  const { add, remove } = labelChanges(checkRuns);

  // 3. Swap its deploy label.
  for (const pull of merged) {
    for (const name of remove) {
      await github.removeLabel(pull.number, name);
    }
    const label = Object.values(LABELS).find((candidate) => candidate.name === add);
    if (label) {
      await github.addLabel(pull.number, label);
    }
    console.log(`#${pull.number}: ${add ? `labeled "${add}"` : `removed ${remove.join(', ') || 'nothing'}`}.`);
  }
}

if (import.meta.main) {
  await main();
}
