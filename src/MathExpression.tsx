import katex from 'katex';

type Props = {
  /** A TeX expression, e.g. `f_2 = 2f_1`. */
  expression: string;

  /** Render as a centered block equation instead of inline. */
  display?: boolean;
};

/** Renders TeX with KaTeX, falling back to the raw source if it doesn't parse. */
export function MathExpression({ expression, display = false }: Props) {
  let html: string;
  try {
    // `trust: false` stops TeX from producing links, classes, or other raw HTML.
    html = katex.renderToString(expression, { displayMode: display, throwOnError: true, trust: false });
  } catch {
    return (
      <code className="math-error" aria-label={`Unrendered equation: ${expression}`}>
        {expression}
      </code>
    );
  }

  return <span className={display ? 'math-display' : 'math'} dangerouslySetInnerHTML={{ __html: html }} />;
}
