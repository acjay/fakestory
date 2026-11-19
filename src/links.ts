/**
 * How the reader interprets links in rich text.
 *
 * Prototype convention: glossary terms and footnotes are ordinary links to
 * first-party URLs, e.g. https://fakestory.music/terminology/octave. This is
 * a placeholder, not a chosen authoring format.
 */

export type ReferenceLink = { kind: 'glossary' | 'footnotes'; id: string };

const REFERENCE_HOST = 'fakestory.music';
const REFERENCE_PATH = /^\/(glossary|terminology|footnotes)\/([a-z0-9-]+)\/?$/;

/**
 * Parse a glossary or footnote link. Anything that isn't exactly the expected
 * shape (other hosts, query strings, fragments) is treated as a normal link.
 */
export function parseReference(href?: string | null): ReferenceLink | null {
  if (!href) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  const isFirstParty =
    url.protocol === 'https:' && url.hostname === REFERENCE_HOST && !url.port && !url.search && !url.hash;
  if (!isFirstParty) {
    return null;
  }

  const match = url.pathname.match(REFERENCE_PATH);
  if (!match) {
    return null;
  }

  const [, section, id] = match;
  // "terminology" is accepted as an alias of "glossary".
  return { kind: section === 'footnotes' ? 'footnotes' : 'glossary', id };
}

const SAFE_PROTOCOLS = ['https:', 'http:', 'mailto:'];

/**
 * Return the href if it's safe to render as a link, or undefined. This blocks
 * `javascript:` and other script-capable URLs coming from content.
 */
export function safeHref(href?: string | null): string | undefined {
  if (!href) {
    return undefined;
  }

  // In-page anchors.
  if (href.startsWith('#')) {
    return href;
  }

  try {
    return SAFE_PROTOCOLS.includes(new URL(href).protocol) ? href : undefined;
  } catch {
    return undefined;
  }
}
