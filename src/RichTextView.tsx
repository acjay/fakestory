import { Fragment, type ReactNode } from 'react';

import { parseReference, safeHref } from './links';
import { MathExpression } from './MathExpression';
import type { RichText } from './model';
import { ReferencePopup } from './ReferencePopup';
import { useReferences } from './references';

/** Renders a block's rich-text runs as inline content. */
export function RichTextView({ values }: { values: RichText[] }) {
  return (
    <>
      {values.map((run, index) => (
        // Runs have no IDs and never reorder within a render, so index keys are fine.
        <Fragment key={index}>
          <RichTextRun run={run} />
        </Fragment>
      ))}
    </>
  );
}

function RichTextRun({ run }: { run: RichText }) {
  const { glossary, footnotes } = useReferences();

  let content: ReactNode =
    run.type === 'equation' ? (
      <MathExpression expression={run.equation?.expression ?? run.plain_text} />
    ) : (
      run.plain_text
    );

  // Wrap in formatting tags, innermost first.
  const annotations = run.annotations ?? {};
  if (annotations.code) content = <code>{content}</code>;
  if (annotations.bold) content = <strong>{content}</strong>;
  if (annotations.italic) content = <em>{content}</em>;
  if (annotations.strikethrough) content = <s>{content}</s>;
  if (annotations.underline) content = <u>{content}</u>;

  // Then the outermost layer: a reference popup, a plain link, or nothing.
  const reference = parseReference(run.href);

  if (reference?.kind === 'glossary' && glossary[reference.id]) {
    const term = glossary[reference.id];
    return <ReferencePopup label={content} title={term.name} body={term.definition} />;
  }

  if (reference?.kind === 'footnotes' && footnotes[reference.id]) {
    return <ReferencePopup label={content} title="Note" body={footnotes[reference.id]} />;
  }

  const href = safeHref(run.href);
  if (href) {
    return <a href={href}>{content}</a>;
  }

  return content;
}
