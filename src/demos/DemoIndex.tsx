/**
 * The demo index at /demos/: every rebuilt demo, with a link to its page,
 * the URL to embed in Notion, ready-made variants with their own URLs, and
 * the parameters for setting up others.
 * Generated from the registry, so a new demo appears here automatically.
 */

import { useState } from 'react';

import { DEMOS } from './registry';

import './demo.css';

export function DemoIndex({ origin }: { origin: string }) {
  return (
    <div className="demo demo-index">
      <h1>Demos</h1>
      <p className="demo-index-intro">
        Interactive demos for The Fake Story of Music. Each has its own page, which can be embedded in Notion: paste its
        URL into an embed block. Add parameters to the URL to set up a variant.
      </p>

      <ul className="demo-index-list">
        {Object.entries(DEMOS).map(([slug, demo]) => {
          const url = `${origin}/demos/${slug}/`;

          return (
            <li key={slug} className="demo-panel">
              <h2>
                <a href={`/demos/${slug}/`}>{demo.title}</a>
              </h2>
              <p>{demo.description}</p>

              <div className="demo-index-url">
                <code>{url}</code>
                <CopyButton text={url} />
              </div>

              {demo.variants.length > 0 && (
                <>
                  <h3 className="demo-index-heading">Variants</h3>
                  <ul className="demo-index-variants">
                    {demo.variants.map((variant) => {
                      // Shown as written, copied percent-encoded (e.g. spaces in captions).
                      const path = `/demos/${slug}/?${variant.query}`;
                      const embedUrl = encodeURI(origin + path);

                      return (
                        <li key={variant.query}>
                          <a href={encodeURI(path)}>{variant.name}</a>
                          <div className="demo-index-url">
                            <code>{origin + path}</code>
                            <CopyButton text={embedUrl} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {demo.parameters.length > 0 && (
                <table className="demo-index-parameters">
                  <caption>Parameters</caption>
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Values</th>
                      <th scope="col">Effect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demo.parameters.map((parameter) => (
                      <tr key={parameter.name}>
                        <th scope="row">
                          <code>{parameter.name}</code>
                        </th>
                        <td>{parameter.values}</td>
                        <td>{parameter.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. not a secure context): the URL is still selectable.
    }
  };

  return (
    <button type="button" onClick={copy} aria-live="polite">
      {copied ? 'Copied' : 'Copy URL'}
    </button>
  );
}
