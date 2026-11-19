import { MathExpression } from './MathExpression';
import type { Block, RichText } from './model';
import { RichTextView } from './RichTextView';

/** Renders a list of sibling blocks. */
export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
    </>
  );
}

/**
 * Renders one block and, recursively, its children. Unknown block types are
 * shown as a visible notice rather than silently dropped.
 */
export function BlockView({ block }: { block: Block }) {
  const data = typeData(block);
  const text = <RichTextView values={(data.rich_text as RichText[] | undefined) ?? []} />;
  const children = block.children?.length ? <Blocks blocks={block.children} /> : null;

  switch (block.type) {
    // The page title is the only <h1>, so Notion headings start at <h2>.
    case 'heading_1':
      return (
        <section className="section-heading">
          <h2>{text}</h2>
          {children}
        </section>
      );

    case 'heading_2':
      return (
        <>
          <h3>{text}</h3>
          {children}
        </>
      );

    case 'heading_3':
      return (
        <>
          <h4>{text}</h4>
          {children}
        </>
      );

    case 'paragraph':
      return (
        <>
          <p>{text}</p>
          {children}
        </>
      );

    case 'quote':
      return (
        <blockquote>
          {text}
          {children}
        </blockquote>
      );

    case 'column_list':
      return <div className="columns">{children}</div>;

    case 'column':
      return <div className="column">{children}</div>;

    case 'equation':
      return <MathExpression expression={String(data.expression ?? '')} display />;

    case 'divider':
      return <hr />;

    // Embeds are never loaded from content. Demos will be rebuilt in this codebase.
    case 'embed':
      return <DemoPlaceholder />;

    default:
      return (
        <div className="unsupported" role="note">
          Unsupported block: {block.type}
          {children}
        </div>
      );
  }
}

/** The type-specific payload, e.g. `block.paragraph` for a paragraph. */
function typeData(block: Block): Record<string, unknown> {
  return (block[block.type] ?? {}) as Record<string, unknown>;
}

function DemoPlaceholder() {
  return (
    <div className="demo-placeholder">
      <span className="demo-label">Interactive demo</span>
      <strong>Listening experiment</strong>
      <p>A future home for sound and interaction.</p>
      <span className="demo-status">Not yet implemented</span>
    </div>
  );
}
