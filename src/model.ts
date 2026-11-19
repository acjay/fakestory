// The supported subset of the Notion REST API response. Other fields are ignored.
export type RichText = {
  type: 'text' | 'equation' | 'mention';
  plain_text: string;
  href?: string | null;
  text?: { content: string; link?: { url: string } | null };
  equation?: { expression: string };
  annotations?: { bold?: boolean; italic?: boolean; strikethrough?: boolean; underline?: boolean; code?: boolean };
};
export type Block = {
  id: string;
  type: string;
  has_children?: boolean;
  children?: Block[];
  [key: string]: unknown;
};
export type Story = {
  title: string;
  blocks: Block[];
  glossary: Record<string, { name: string; definition: string }>;
  footnotes: Record<string, string>;
};

// Only intentional, first-party links are interpreted as prototype references.
export function reference(href?: string | null): { kind: 'glossary' | 'footnotes'; id: string } | null {
  if (!href) return null;
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || url.hostname !== 'fakestory.music' || url.port || url.search || url.hash) return null;
    const match = url.pathname.match(/^\/(glossary|terminology|footnotes)\/([a-z0-9-]+)\/?$/);
    if (!match) return null;
    return { kind: match[1] === 'terminology' ? 'glossary' : match[1] as 'glossary' | 'footnotes', id: match[2] };
  } catch { return null; }
}

export function safeHref(href?: string | null): string | undefined {
  if (!href) return undefined;
  if (href.startsWith('#')) return href;
  try {
    const url = new URL(href);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? href : undefined;
  } catch { return undefined; }
}
