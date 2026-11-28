/**
 * Labels a merged pull request with the state of its production deploy:
 * `deploying` while Cloudflare builds and deploys `main`, then `deployed`
 * or `deploy failed`. So the pull request shows when its change is live.
 *
 * Cloudflare's Workers Builds deploys `main` and reports each build as a
 * check on the commit. .github/workflows/deploy-labels.yml runs this when
 * that check starts or finishes, with GITHUB_TOKEN, GITHUB_REPOSITORY,
 * COMMIT_SHA, CHECK_ACTION and CHECK_CONCLUSION set.
 */

import { createGitHub } from './github.ts';

export const LABELS = {
  deploying: { name: 'deploying', color: 'fbca04', description: 'Deploying to production' },
  deployed: { name: 'deployed', color: '0e8a16', description: 'Deployed to production' },
  failed: { name: 'deploy failed', color: 'b60205', description: 'The production deploy failed' },
};

type LabelName = (typeof LABELS)[keyof typeof LABELS]['name'];

/**
 * Which labels a check event adds and removes. A deploy that's cancelled
 * or skipped (e.g. replaced by a newer one) just loses `deploying`.
 */
export function labelChanges(action: string, conclusion: string | undefined): { add?: LabelName; remove: LabelName[] } {
  const all: LabelName[] = Object.values(LABELS).map((label) => label.name);
  const others = (kept: LabelName) => all.filter((name) => name !== kept);

  if (action === 'created' || action === 'rerequested') {
    return { add: LABELS.deploying.name, remove: others(LABELS.deploying.name) };
  }
  if (action !== 'completed') {
    return { remove: [] };
  }

  if (conclusion === 'success') {
    return { add: LABELS.deployed.name, remove: others(LABELS.deployed.name) };
  }
  if (conclusion === 'failure' || conclusion === 'timed_out' || conclusion === 'action_required') {
    return { add: LABELS.failed.name, remove: others(LABELS.failed.name) };
  }
  return { remove: [LABELS.deploying.name] };
}

async function main() {
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, COMMIT_SHA, CHECK_ACTION, CHECK_CONCLUSION } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !COMMIT_SHA || !CHECK_ACTION) {
    throw new Error('Set GITHUB_TOKEN, GITHUB_REPOSITORY, COMMIT_SHA and CHECK_ACTION.');
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

  // 2. Swap its deploy label.
  const { add, remove } = labelChanges(CHECK_ACTION, CHECK_CONCLUSION || undefined);
  for (const pull of merged) {
    for (const name of remove) {
      await github.removeLabel(pull.number, name);
    }
    const label = Object.values(LABELS).find((candidate) => candidate.name === add);
    if (label) {
      await github.addLabel(pull.number, label);
    }
    console.log(
      `#${pull.number}: ${add ? `labeled "${add}"` : 'removed "deploying"'} (${CHECK_ACTION}, ${CHECK_CONCLUSION || 'running'}).`,
    );
  }
}

if (import.meta.main) {
  await main();
}
