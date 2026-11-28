import { describe, expect, it } from 'vitest';

import { CLOUDFLARE_APP, labelChanges, type CheckRun } from '../scripts/deploy-labels.ts';

const cloudflare = (id: number, status: string, conclusion: string | null = null): CheckRun => ({
  id,
  status,
  conclusion,
  app: { slug: CLOUDFLARE_APP },
});

describe('deploy labels', () => {
  it('mark a pull request as deploying while Cloudflare’s check is running', () => {
    expect(labelChanges([cloudflare(1, 'in_progress')])).toEqual({
      add: 'deploying',
      remove: ['deployed', 'deploy failed'],
    });
    expect(labelChanges([cloudflare(1, 'queued')]).add).toBe('deploying');
  });

  it('show deployed or deploy failed once it finishes', () => {
    expect(labelChanges([cloudflare(1, 'completed', 'success')])).toEqual({
      add: 'deployed',
      remove: ['deploying', 'deploy failed'],
    });
    expect(labelChanges([cloudflare(1, 'completed', 'failure')]).add).toBe('deploy failed');
    expect(labelChanges([cloudflare(1, 'completed', 'timed_out')]).add).toBe('deploy failed');
  });

  it('follow Cloudflare’s latest check, whatever order the events came in', () => {
    // E.g. an in-progress check, then a second, already finished one.
    expect(labelChanges([cloudflare(2, 'completed', 'success'), cloudflare(1, 'in_progress')]).add).toBe('deployed');
    expect(labelChanges([cloudflare(1, 'completed', 'success'), cloudflare(2, 'in_progress')]).add).toBe('deploying');
  });

  it('ignore other apps’ checks, including this workflow’s own', () => {
    const ours: CheckRun = { id: 9, status: 'in_progress', conclusion: null, app: { slug: 'github-actions' } };

    expect(labelChanges([cloudflare(1, 'completed', 'success'), ours]).add).toBe('deployed');
    expect(labelChanges([ours])).toEqual({ remove: [] });
  });

  it('only remove deploying when a deploy is cancelled or skipped', () => {
    expect(labelChanges([cloudflare(1, 'completed', 'cancelled')])).toEqual({ remove: ['deploying'] });
    expect(labelChanges([cloudflare(1, 'completed', 'skipped')])).toEqual({ remove: ['deploying'] });
  });
});
