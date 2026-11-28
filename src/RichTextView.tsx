import { Fragment, type ReactNode } from 'react';

import { Footnote } from './Footnote';
import { parseGlossaryLink, safeHref } from './links';
import { MathExpression } from './MathExpression';
import type { RichText } from './model';
import { ReferencePopup } from './ReferencePopup';
import { useReferences } from './references';

/**
 * Renders a block's rich-text runs as inline content. Consecutive runs that
 * share a footnote are wrapped together, so one marker follows the whole
 * anchor even when it spans several formats.
 */
export function RichTextView({ values }: { values: RichText[] }) {
  const { footnotes } = useReferences();

  return (
    <>
      {groupByFootnote(values).map((group, index) => {
        const runs = group.runs.map((run, runIndex) => <RichTextRun key={runIndex} run={run} />);
        const note = group.footnote ? footnotes[group.footnote] : undefined;

        // Runs have no IDs and never reorder within a render, so index keys are fine.
        return (
          <Fragment key={index}>
            {note ? <Footnote note={<RichTextView values={note} />}>{runs}</Footnote> : runs}
          </Fragment>
        );
      })}
    </>
  );
}

type RunGroup = { footnote?: string; runs: RichText[] };

/** Split runs into consecutive groups with the same footnote (or none). */
function groupByFootnote(values: RichText[]): RunGroup[] {
  const groups: RunGroup[] = [];

  for (const run of values) {
    const last = groups.at(-1);

    if (last && last.footnote === run.footnote) {
      last.runs.push(run);
    } else {
      groups.push({ footnote: run.footnote, runs: [run] });
    }
  }

  return groups;
}

function RichTextRun({ run }: { run: RichText }) {
  const { glossary } = useReferences();

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

  // Then the outermost layer: a glossary popup, a plain link, or nothing.
  const termId = parseGlossaryLink(run.href);
  const term = termId ? glossary[termId] : undefined;
  if (term) {
    return <ReferencePopup label={content} title={term.name} body={term.definition} />;
  }

  const href = safeHref(run.href);
  if (href) {
    return <a href={href}>{content}</a>;
  }

  return content;
}
