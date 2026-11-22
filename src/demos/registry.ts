/**
 * The rebuilt demos, by URL.
 *
 * Each demo has its own page at /demos/<slug>/ that can be embedded in
 * Notion. When the story embeds one of those URLs, the reader renders the
 * demo itself instead of an iframe. Embeds from anywhere else are never
 * executed: the reader shows a placeholder (see BlockView).
 *
 * Query parameters on the URL configure the demo, so an author sets up a
 * variant in Notion, e.g. /demos/harmonic-tone/?through=1.
 */

import type { ComponentType } from 'react';

import { HarmonicToneDemo } from './harmonicTone/HarmonicToneDemo';

export type DemoComponent = ComponentType<{ params: URLSearchParams }>;

export const DEMOS: Record<string, DemoComponent> = {
  'harmonic-tone': HarmonicToneDemo,
};

/**
 * Hosts whose /demos/ URLs are ours. The public domain is not chosen yet;
 * `fakestory.music` is the placeholder used elsewhere in the prototype. The
 * page's own host also counts, for local development and previews.
 */
export const DEMO_HOSTS = ['fakestory.music'];

const DEMO_PATH = /^\/demos\/([a-z0-9-]+)\/?$/;

/** The demo an embed URL points to, with its configuration, or null. */
export function demoFromUrl(
  url: string | undefined,
  currentHost = globalThis.location?.host,
): { slug: string; Demo: DemoComponent; params: URLSearchParams } | null {
  if (!url) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const isOurs = DEMO_HOSTS.includes(parsed.host) || (currentHost !== undefined && parsed.host === currentHost);
  if (!isOurs || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
    return null;
  }

  const slug = parsed.pathname.match(DEMO_PATH)?.[1];
  const Demo = slug ? DEMOS[slug] : undefined;
  if (!slug || !Demo) {
    return null;
  }

  return { slug, Demo, params: parsed.searchParams };
}
