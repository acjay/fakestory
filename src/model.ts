/**
 * The content model the reader renders.
 *
 * Blocks and rich text deliberately mirror the Notion REST API's shapes (only
 * the subset we support), so an API snapshot can be rendered without a
 * translation step. Fields we don't use are ignored.
 */

/**
 * A run of inline content with uniform formatting. Blocks don't hold text
 * directly: a paragraph, heading, quote, etc. carries an array of these under
 * its type key, e.g. `block.paragraph.rich_text`.
 */
export type RichText = {
  type: 'text' | 'equation' | 'mention';
  plain_text: string;
  href?: string | null;
  text?: { content: string; link?: { url: string } | null };
  equation?: { expression: string };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
  };

  /**
   * Our extension, not part of the Notion API: the ID of the footnote anchored
   * to this run. A footnote anchored across several runs (e.g. bold text then
   * plain text) has the same ID on each of them. Set by the importer.
   */
  footnote?: string;
};

/**
 * One node in the page's block tree. As in the Notion API, the type-specific
 * data lives under a key named after the type: a block with
 * `type: 'paragraph'` has a `paragraph` field.
 */
export type Block = {
  id: string;
  type: string;
  has_children?: boolean;
  children?: Block[];
  [typeKey: string]: unknown;
};

export type GlossaryEntry = { name: string; definition: string };

/** Lookup tables for the glossary terms and footnotes referenced from rich text. */
export type References = {
  glossary: Record<string, GlossaryEntry>;

  /** Footnote text, keyed by the ID in `RichText.footnote`. */
  footnotes: Record<string, RichText[]>;
};

export type Story = References & {
  title: string;
  blocks: Block[];
};
