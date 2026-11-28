/**
 * How the reader interprets links in rich text.
 *
 * Prototype convention: glossary terms are ordinary links to first-party URLs,
 * e.g. https://fakestory.music/terminology/octave. This is a placeholder, not
 * a chosen authoring format. (Footnotes don't use links: see `RichText.footnote`.)
 */

const GLOSSARY_HOST = 'fakestory.music';
const GLOSSARY_PATH = /^\/(?:glossary|terminology)\/([a-z0-9-]+)\/?$/;

/**
 * Parse a glossary link, returning the term's ID. Anything that isn't exactly
 * the expected shape (other hosts, query strings, fragments) is treated as a
 * normal link.
 */
export function parseGlossaryLink(href?: string | null): string | null {
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
    url.protocol === 'https:' && url.hostname === GLOSSARY_HOST && !url.port && !url.search && !url.hash;
  if (!isFirstParty) {
    return null;
  }

  // "terminology" is accepted as an alias of "glossary".
  return url.pathname.match(GLOSSARY_PATH)?.[1] ?? null;
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
