/**
 * A tiny client for the GitHub REST API calls our workflows make, using the
 * workflow's GITHUB_TOKEN. Only Node's built-ins, so workflows can run the
 * scripts without installing anything.
 */

export type GitHub = ReturnType<typeof createGitHub>;

export function createGitHub(token: string, repository: string) {
  async function request(method: string, path: string, body?: unknown): Promise<Response> {
    return fetch(`https://api.github.com/repos/${repository}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /** Make a request that must succeed, and return its JSON. */
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await request(method, path, body);
    if (!response.ok) {
      throw new Error(`GitHub ${method} ${path} failed: HTTP ${response.status} ${await response.text()}`);
    }
    return (response.status === 204 ? undefined : await response.json()) as T;
  }

  /** Every page of a list endpoint. */
  async function all<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    for (let page = 1; ; page++) {
      const separator = path.includes('?') ? '&' : '?';
      const batch = await call<T[]>('GET', `${path}${separator}per_page=100&page=${page}`);
      items.push(...batch);
      if (batch.length < 100) {
        return items;
      }
    }
  }

  /** Add a label to an issue or pull request, creating the label the first time. */
  async function addLabel(number: number, label: { name: string; color: string; description: string }) {
    // 422 means the label already exists.
    const created = await request('POST', '/labels', label);
    if (!created.ok && created.status !== 422) {
      throw new Error(`Creating the label "${label.name}" failed: HTTP ${created.status}`);
    }
    await call('POST', `/issues/${number}/labels`, { labels: [label.name] });
  }

  /** Remove a label from an issue or pull request, if it's there. */
  async function removeLabel(number: number, name: string) {
    // 404 means it wasn't there.
    const removed = await request('DELETE', `/issues/${number}/labels/${encodeURIComponent(name)}`);
    if (!removed.ok && removed.status !== 404) {
      throw new Error(`Removing the label "${name}" failed: HTTP ${removed.status}`);
    }
  }

  return { request, call, all, addLabel, removeLabel };
}
