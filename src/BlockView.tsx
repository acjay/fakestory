import { demoFromUrl } from './demos/registry';
import { MathExpression } from './MathExpression';
import type { Block, RichText } from './model';
import { RichTextView } from './RichTextView';
import { storyImageUrl } from './storyImages';
import { TableView } from './TableView';

/**
 * Renders a list of sibling blocks.
 *
 * Notion has no list block: each list item is its own block. So consecutive
 * items of the same kind are grouped here into one <ul> or <ol>.
 */
export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {groupListItems(blocks).map((group) => {
        if (group.kind === 'block') {
          return <BlockView key={group.block.id} block={group.block} />;
        }

        const List = group.kind === 'bulleted_list_item' ? 'ul' : 'ol';
        return (
          <List key={group.items[0].id}>
            {group.items.map((item) => (
              <BlockView key={item.id} block={item} />
            ))}
          </List>
        );
      })}
    </>
  );
}

const LIST_ITEM_TYPES = ['bulleted_list_item', 'numbered_list_item'] as const;
type ListItemType = (typeof LIST_ITEM_TYPES)[number];

type BlockGroup = { kind: 'block'; block: Block } | { kind: ListItemType; items: Block[] };

/** Group runs of consecutive list items of the same type; other blocks stay single. */
function groupListItems(blocks: Block[]): BlockGroup[] {
  const groups: BlockGroup[] = [];

  for (const block of blocks) {
    const listType = LIST_ITEM_TYPES.find((type) => type === block.type);
    const last = groups.at(-1);

    if (!listType) {
      groups.push({ kind: 'block', block });
    } else if (last && last.kind === listType) {
      last.items.push(block);
    } else {
      groups.push({ kind: listType, items: [block] });
    }
  }

  return groups;
}

/**
 * Renders one block and, recursively, its children. Unknown block types are
 * shown as a visible notice rather than silently dropped.
 */
export function BlockView({ block }: { block: Block }) {
  const data = typeData(block);
  const richText = (data.rich_text as RichText[] | undefined) ?? [];
  const hasText = richText.length > 0;
  const text = <RichTextView values={richText} />;
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

    // Always inside the <ul>/<ol> that `Blocks` wraps around them. Nested
    // items arrive as children, so they become a nested list.
    case 'bulleted_list_item':
    case 'numbered_list_item':
      return (
        <li>
          {text}
          {children}
        </li>
      );

    case 'quote':
      return (
        <blockquote>
          {text}
          {children}
        </blockquote>
      );

    // A highlighted aside, with an optional emoji icon. Only emoji icons are
    // shown: image icons would mean loading files from Notion.
    case 'callout': {
      const icon = data.icon as { type?: string; emoji?: string } | undefined;
      const color = typeof data.color === 'string' ? data.color : 'default';

      return (
        <aside className="callout" data-color={color}>
          {icon?.type === 'emoji' && (
            <span className="callout-icon" aria-hidden="true">
              {icon.emoji}
            </span>
          )}
          <div className="callout-body">
            {hasText && <p>{text}</p>}
            {children}
          </div>
        </aside>
      );
    }

    case 'table':
      return <TableView block={block} />;

    case 'image':
      return <ImageView data={data} />;

    // Content shared between several places in Notion. Its children are the
    // shared content, so it renders as if they were written here. If they're
    // missing (e.g. the original is on a page the integration can't read),
    // say so rather than silently showing nothing.
    case 'synced_block':
      return (
        children ?? (
          <div className="unsupported" role="note">
            Synced block with no content
          </div>
        )
      );

    case 'column_list':
      return <div className="columns">{children}</div>;

    case 'column':
      return <div className="column">{children}</div>;

    case 'equation':
      return <MathExpression expression={String(data.expression ?? '')} display />;

    case 'divider':
      return <hr />;

    // Our own demos render directly. Any other embed is never loaded from
    // content: it shows a placeholder until its demo is rebuilt here.
    case 'embed': {
      const demo = demoFromUrl(typeof data.url === 'string' ? data.url : undefined);
      return demo ? (
        <div className="demo-embed">
          <demo.Demo params={demo.params} title={demo.title} />
        </div>
      ) : (
        <DemoPlaceholder />
      );
    }

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
    <div className="embed-placeholder">
      <span className="embed-placeholder-label">Interactive demo</span>
      <strong>Listening experiment</strong>
      <p>A future home for sound and interaction.</p>
      <span className="embed-placeholder-status">Not yet implemented</span>
    </div>
  );
}

/**
 * An image from the story, served from the site (see scripts/images.ts).
 * Notion's API has no alt text, so the caption doubles as the text
 * alternative. An image that isn't available locally gets a visible notice.
 */
function ImageView({ data }: { data: Record<string, unknown> }) {
  const caption = (data.caption as RichText[] | undefined) ?? [];
  const url = data.type === 'local' && typeof data.path === 'string' ? storyImageUrl(data.path) : undefined;

  if (!url) {
    return (
      <div className="unsupported" role="note">
        Image not available: run the import to download it
      </div>
    );
  }

  return (
    <figure className="story-image">
      <img src={url} alt={caption.map((run) => run.plain_text).join('')} loading="lazy" decoding="async" />
      {caption.length > 0 && (
        <figcaption>
          <RichTextView values={caption} />
        </figcaption>
      )}
    </figure>
  );
}
