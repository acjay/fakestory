import { describe, expect, it } from 'vitest';

import { labelChanges } from '../scripts/deploy-labels.ts';

describe('deploy labels', () => {
  it('mark a pull request as deploying when the production build starts, or is retried', () => {
    expect(labelChanges('created', undefined)).toEqual({ add: 'deploying', remove: ['deployed', 'deploy failed'] });
    expect(labelChanges('rerequested', undefined).add).toBe('deploying');
  });

  it('swap deploying for deployed or deploy failed when it finishes', () => {
    expect(labelChanges('completed', 'success')).toEqual({ add: 'deployed', remove: ['deploying', 'deploy failed'] });
    expect(labelChanges('completed', 'failure')).toEqual({ add: 'deploy failed', remove: ['deploying', 'deployed'] });
    expect(labelChanges('completed', 'timed_out').add).toBe('deploy failed');
  });

  it('only remove deploying when a deploy is cancelled or skipped', () => {
    expect(labelChanges('completed', 'cancelled')).toEqual({ remove: ['deploying'] });
    expect(labelChanges('completed', 'skipped')).toEqual({ remove: ['deploying'] });
  });

  it('ignore other check events', () => {
    expect(labelChanges('requested_action', undefined)).toEqual({ remove: [] });
  });
});
