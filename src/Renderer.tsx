import { Fragment, useId, useState, type ReactNode } from 'react';
import katex from 'katex';
import type { Block, RichText, Story } from './model';
import { reference, safeHref } from './model';

function Math({ expression, display = false }: { expression: string; display?: boolean }) {
  try {
    return <span className={display ? 'math-display' : 'math'} dangerouslySetInnerHTML={{ __html: katex.renderToString(expression, { displayMode: display, throwOnError: true, trust: false }) }} />;
  } catch {
    return <code className="math-error" aria-label={`Unrendered equation: ${expression}`}>{expression}</code>;
  }
}

function ReferencePopup({ label, title, body }: { label: ReactNode; title: string; body: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <span className="inline-detail" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}><button type="button" className="reference-trigger" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>{label}</button>{open && <span id={id} className="detail-body"><strong>{title}</strong><span>{body}</span></span>}</span>;
}

function Rich({ values, story }: { values: RichText[]; story: Story }) {
  return <>{values.map((r, i) => {
    let content: ReactNode = r.type === 'equation' ? <Math expression={r.equation?.expression ?? r.plain_text} /> : r.plain_text;
    if (r.annotations?.code) content = <code>{content}</code>;
    if (r.annotations?.bold) content = <strong>{content}</strong>;
    if (r.annotations?.italic) content = <em>{content}</em>;
    if (r.annotations?.strikethrough) content = <s>{content}</s>;
    if (r.annotations?.underline) content = <u>{content}</u>;
    const ref = reference(r.href);
    const term = ref?.kind === 'glossary' ? story.glossary[ref.id] : undefined;
    const note = ref?.kind === 'footnotes' ? story.footnotes[ref.id] : undefined;
    if (term) content = <ReferencePopup label={content} title={term.name} body={term.definition} />;
    else if (note) content = <ReferencePopup label={content} title="Note" body={note} />;
    else if (safeHref(r.href)) content = <a href={safeHref(r.href)}>{content}</a>;
    return <Fragment key={i}>{content}</Fragment>;
  })}</>;
}

function payload(block: Block): Record<string, unknown> {
  return (block[block.type] ?? {}) as Record<string, unknown>;
}
function Blocks({ blocks, story }: { blocks: Block[]; story: Story }) {
  return <>{blocks.map(block => <BlockView key={block.id} block={block} story={story} />)}</>;
}
function BlockView({ block, story }: { block: Block; story: Story }) {
  const data = payload(block);
  const rich = <Rich values={(data.rich_text as RichText[] | undefined) ?? []} story={story} />;
  const children = block.children?.length ? <Blocks blocks={block.children} story={story} /> : null;
  switch (block.type) {
    case 'heading_1': return <section className="section-heading"><span className="eyebrow">Reading prototype</span><h2>{rich}</h2>{children}</section>;
    case 'heading_2': return <><h3>{rich}</h3>{children}</>;
    case 'heading_3': return <><h4>{rich}</h4>{children}</>;
    case 'paragraph': return <><p>{rich}</p>{children}</>;
    case 'column_list': return <div className="columns">{children}</div>;
    case 'column': return <div className="column">{children}</div>;
    case 'equation': return <Math expression={String(data.expression ?? '')} display />;
    case 'divider': return <hr />;
    case 'quote': return <blockquote>{rich}{children}</blockquote>;
    case 'embed': return <div className="demo-placeholder"><span className="demo-label">Interactive demo</span><strong>Listening experiment</strong><p>A future home for sound and interaction.</p><span className="demo-status">Not yet implemented</span></div>;
    default: return <div className="unsupported" role="note">Unsupported block: {block.type}{children}</div>;
  }
}
export function Reader({ story }: { story: Story }) {
  return <main id="main" className="shell"><header className="site-header"><a href="#main" className="brand"><span className="brand-mark" aria-hidden="true">♫</span><span>The Fake Story<br />of Music</span></a><span className="status">Reading prototype</span></header><article><div className="hero"><div className="hero-kicker">A story about how music works <span> / </span> Prototype 01</div><h1>{story.title}</h1><p className="hero-deck">An exploration of the sounds, patterns, and choices behind the music we know.</p><div className="hero-rule"><span>01</span><span>Start reading ↓</span></div></div><div className="reading"><Blocks blocks={story.blocks} story={story} /></div></article><footer><span>The Fake Story of Music</span><span>Prototype · Sample content only</span></footer></main>;
}
