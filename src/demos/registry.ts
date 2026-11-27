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
import { NumberLineDemo } from './numberLine/NumberLineDemo';
import { ScaleGeneratorDemo } from './scaleGenerator/ScaleGeneratorDemo';

export type DemoComponent = ComponentType<{ params: URLSearchParams }>;

export type DemoEntry = {
  title: string;

  /** One line on what the reader can do with it, for the demo index. */
  description: string;

  /** The URL parameters it accepts, for authors setting up variants. */
  parameters: { name: string; values: string; description: string }[];

  Component: DemoComponent;
};

export const DEMOS: Record<string, DemoEntry> = {
  'harmonic-tone': {
    title: 'Harmonic tone',
    description:
      'Build a tone from up to 16 harmonics of a fundamental: hear it, see its waveform, and switch harmonics on, off or solo.',
    parameters: [
      {
        name: 'fundamental',
        values: '80–400',
        description: 'Fundamental in hertz. If omitted, follows the reader’s tone settings (default 200).',
      },
      {
        name: 'profile',
        values: 'sawtooth, square, triangle',
        description:
          'Harmonic recipe: all harmonics at 1/n, odd at 1/n, or odd at 1/n². If omitted, follows the reader’s tone settings (default square).',
      },
      { name: 'through', values: '1, 2, 4, 8, 16', description: 'Include harmonics up to this one. Default 4.' },
    ],
    Component: HarmonicToneDemo,
  },

  'scale-generator': {
    title: 'Scale generator',
    description:
      'Grow a scale one fifth at a time on the octave circle, hear its notes, and see how evenly they divide the octave at each size.',
    parameters: [{ name: 'size', values: '1–53', description: 'Number of notes to start with. Default 12.' }],
    Component: ScaleGeneratorDemo,
  },

  'number-line': {
    title: 'Number line',
    description:
      'Notes along a line, spaced by cents or by hertz: hear them, step through them, and see the gaps between neighbors.',
    parameters: [
      {
        name: 'notes',
        values: 'e.g. α0,β0,α1,β1,α2,β2',
        description:
          'Notes by Greek letter and octave, separated by commas. Use | between groups for a step-through, e.g. α1|β1|α2,γ2|γ1. Default α0,β0,α1,β1,α2,β2.',
      },
      {
        name: 'fifths',
        values: '1–12',
        description:
          'Instead of notes: the first this-many notes, each a fifth above the last, in one octave, plus α2.',
      },
      { name: 'scale', values: 'cents, hertz', description: 'Space notes by cents or by frequency. Default cents.' },
      { name: 'gaps', values: '1', description: 'Label the gap between neighboring notes.' },
    ],
    Component: NumberLineDemo,
  },
};

/**
 * Hosts whose /demos/ URLs are ours: production on Cloudflare, plus
 * `fakestory.music`, a placeholder for a future custom domain. The page's own
 * host also counts, for local development and preview builds. Embeds in the
 * story should point at production, e.g.
 * https://fakestory.alanjay1.workers.dev/demos/harmonic-tone/.
 */
export const DEMO_HOSTS = ['fakestory.alanjay1.workers.dev', 'fakestory.music'];

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
  const Demo = slug ? DEMOS[slug]?.Component : undefined;
  if (!slug || !Demo) {
    return null;
  }

  return { slug, Demo, params: parsed.searchParams };
}
