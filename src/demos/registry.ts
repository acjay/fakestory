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
import { NoteButtonsDemo } from './noteButtons/NoteButtonsDemo';
import { NumberLineDemo } from './numberLine/NumberLineDemo';
import { ScaleGeneratorDemo } from './scaleGenerator/ScaleGeneratorDemo';

export type DemoComponent = ComponentType<{
  params: URLSearchParams;

  /** Shown in the demo's header bar, after "Demo:". */
  title: string;
}>;

export type DemoEntry = {
  /** The demo's name, and its header title unless the URL gives another. */
  title: string;

  /** One line on what the reader can do with it, for the demo index. */
  description: string;

  /** The URL parameters it accepts, for authors setting up variants. */
  parameters: { name: string; values: string; description: string }[];

  /**
   * Ready-made configurations, linked from the demo index so their URLs
   * never need writing by hand. Queries are written readably, unencoded
   * (so no `&`, `#` or `+` inside values); the index encodes them. A
   * variant's `title`, if any, goes in its URL as the header title.
   */
  variants: { name: string; query: string; title?: string }[];

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
    variants: [
      { name: 'The fundamental alone', query: 'through=1' },
      { name: 'With the octave', query: 'through=2' },
      { name: 'All 16 harmonics', query: 'through=16' },
    ],
    Component: HarmonicToneDemo,
  },

  'scale-generator': {
    title: 'Scale generator',
    description:
      'Grow a scale one fifth at a time on the octave circle, hear its notes, and see how evenly they divide the octave at each size.',
    parameters: [{ name: 'size', values: '1–53', description: 'Number of notes to start with. Default 12.' }],
    variants: [
      { name: 'The ever-tightening circle', title: 'The ever-tightening circle', query: 'size=12' },
      { name: 'Starting at 5 notes', query: 'size=5' },
      { name: 'Starting at 7 notes', query: 'size=7' },
      { name: 'Starting at 53 notes', query: 'size=53' },
    ],
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
          'Notes by Greek letter and octave, separated by commas. Use | between groups for a step-through, e.g. α1|β1|α2,γ2|γ1. Add home to highlight the home octave (α1 to α2) from that step on. Default α0,β0,α1,β1,α2,β2.',
      },
      {
        name: 'fifths',
        values: '1–12',
        description:
          'Instead of notes: the first this-many notes, each a fifth above the last, in one octave, plus α2.',
      },
      { name: 'scale', values: 'cents, hertz', description: 'Space notes by cents or by frequency. Default cents.' },
      {
        name: 'captions',
        values: 'text, | between steps',
        description:
          'What each step of a step-through says, after “Step 2 of 4:”. Steps without one say which notes they add.',
      },
      { name: 'gaps', values: '1', description: 'Label the gap between neighboring notes.' },
    ],
    // The six CodePen number lines this demo replaces (see legacy-demos/README.md).
    variants: [
      {
        name: 'Our happy interval, by hertz',
        title: 'Our happy interval, by hertz',
        query: 'notes=α0,β0,α1,β1,α2,β2,home&scale=hertz',
      },
      {
        name: 'Our happy interval, by cents',
        title: 'Our happy interval, by cents',
        query: 'notes=α0,β0,α1,β1,α2,β2,home',
      },
      {
        name: '3’s a crowd (step-through)',
        title: '3’s a crowd',
        query:
          'notes=α1|α2,home|β1|γ2|γ1&captions=' +
          [
            'Start with α1.',
            'Add α2 an octave (1200 cents) above α1 to define our home octave.',
            'Add β1 702 cents above α1.',
            'Add γ 702 cents above β1. Name it γ2, because it is above α2.',
            'Add γ1 an octave (1200 cents) below γ2.',
          ].join('|'),
      },
      { name: 'The quest for even spacing: 5 notes', title: 'The quest for even spacing', query: 'fifths=5&gaps=1' },
      { name: 'Onwards to 7 notes', title: 'Onwards to 7 notes', query: 'fifths=7&gaps=1' },
      { name: 'More evenness: 12 notes', title: 'More evenness', query: 'fifths=12&gaps=1' },
    ],
    Component: NumberLineDemo,
  },

  'note-buttons': {
    title: 'Note buttons',
    description: 'Buttons that play a note, or a few notes together, in the reader’s tone.',
    parameters: [
      {
        name: 'buttons',
        values: 'e.g. α1,γ1|α1,β1',
        description:
          'Notes by Greek letter and octave. Use | between buttons and , to join the notes one button plays together. Default α1.',
      },
    ],
    // The four CodePen pens this demo replaces (see legacy-demos/README.md).
    variants: [
      { name: 'Our base tone', title: 'Our base tone', query: 'buttons=α1' },
      { name: 'An octave up', title: 'An octave up', query: 'buttons=α2' },
      { name: 'An octave down', title: 'An octave down', query: 'buttons=α0' },
      { name: 'Two-note harmonies', title: 'Two-note harmonies', query: 'buttons=α1,γ1|α1,β1' },
    ],
    Component: NoteButtonsDemo,
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

/** Every demo accepts this, for the title in its header bar. */
export const TITLE_PARAMETER = 'title';

/** The header title for a demo: the URL's `title`, if given, or else the demo's name. */
export function demoTitle(slug: string, params: URLSearchParams): string {
  return params.get(TITLE_PARAMETER)?.trim() || (DEMOS[slug]?.title ?? '');
}

/** The demo an embed URL points to, with its configuration, or null. */
export function demoFromUrl(
  url: string | undefined,
  currentHost = globalThis.location?.host,
): { slug: string; Demo: DemoComponent; params: URLSearchParams; title: string } | null {
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

  return { slug, Demo, params: parsed.searchParams, title: demoTitle(slug, parsed.searchParams) };
}
